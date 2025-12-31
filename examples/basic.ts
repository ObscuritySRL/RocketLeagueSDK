/**
 * Basic SDK Usage Example
 *
 * This example demonstrates how to read game data from Rocket League
 * using the generated SDK types and offsets.
 *
 * Run with: bun run examples/basic.ts
 */

import Memory from 'bun-memory';

// Import SDK types and offsets
import type { Structs } from '..';
import { GNAMES_OFFSET, GOBJECTS_OFFSET, UObject, FNameEntry } from '../types/offsets';

// CarComponent_Boost_TA offsets
// Found in: classes/TAGame.ts - search for "CarComponent_Boost_TA"
const BoostOffsets = {
  CurrentBoostAmount: 0x0338,  // float - current boost (0.0 to MaxBoostAmount)
  MaxBoostAmount: 0x032c,      // float - maximum boost capacity
} as const;

// =============================================================================
// MEMORY ACCESS
// =============================================================================

// Open the process
const rl = new Memory('RocketLeague.exe');
const module = rl.modules['RocketLeague.exe'];

if (!module) {
  throw new Error('RocketLeague.exe not found. Is the game running?');
}

const base = module.base;

// Calculate absolute addresses from base + offset
const gNamesPtr = rl.uPtr(base + GNAMES_OFFSET);
const gObjectsPtr = rl.uPtr(base + GOBJECTS_OFFSET);

console.log('=== Rocket League SDK Example ===');
console.log(`Base: 0x${base.toString(16).toUpperCase()}`);
console.log(`GNames: 0x${gNamesPtr.toString(16).toUpperCase()}`);
console.log(`GObjects: 0x${gObjectsPtr.toString(16).toUpperCase()}`);
console.log();

// =============================================================================
// NAME RESOLUTION
// =============================================================================

/**
 * Get a name string from GNames by index.
 * GNames is a global array of all unique name strings in the engine.
 *
 * @param index - Index into the GNames array
 * @returns The name string
 */
function getName(index: number): string {
  try {
    // GNames is an array of pointers, 8 bytes each (64-bit)
    const entryPtr = rl.uPtr(gNamesPtr + BigInt(index) * 8n);
    if (entryPtr === 0n) return "";

    // Read the wide string at FNameEntry.Name offset
    // FNameEntry structure: [0x00-0x0F: metadata] [0x10+: name string]
    const namePtr = entryPtr + BigInt(FNameEntry.Name);

    // Read up to 256 characters (512 bytes for UTF-16)
    const buf = Buffer.allocUnsafe(512);
    rl.read(namePtr, buf);
    const str = buf.toString('utf16le');
    const nullIdx = str.indexOf('\0');
    return nullIdx >= 0 ? str.slice(0, nullIdx) : str;
  } catch {
    return "<error>";
  }
}

// =============================================================================
// OBJECT ITERATION
// =============================================================================

/**
 * Get the class name of a UObject.
 *
 * Every UObject has a Class pointer that points to its UClass.
 * The UClass itself is a UObject, so we can get its name.
 *
 * @param objPtr - Pointer to the UObject
 * @returns Class name string
 */
function getClassName(objPtr: bigint): string {
  try {
    // Read the Class pointer from the UObject
    const classPtr = rl.uPtr(objPtr + BigInt(UObject.Class));
    if (classPtr === 0n) return "";

    // Get the name index from the class UObject
    const nameIndex = rl.i32(classPtr + BigInt(UObject.Name));
    return getName(nameIndex);
  } catch {
    return "<error>";
  }
}

/**
 * Get the full name of a UObject (including outer chain).
 *
 * Format: "ClassName OuterChain.ObjectName"
 * Example: "CarComponent_Boost_TA TAGame.Default__Car_TA.BoostComponent"
 *
 * @param objPtr - Pointer to the UObject
 * @returns Full name string
 */
function getObjectFullName(objPtr: bigint): string {
  try {
    const className = getClassName(objPtr);
    const nameIndex = rl.i32(objPtr + BigInt(UObject.Name));
    const name = getName(nameIndex);

    // Build outer chain (package path)
    const outers: string[] = [];
    let outer = rl.uPtr(objPtr + BigInt(UObject.Outer));
    while (outer !== 0n) {
      const outerNameIdx = rl.i32(outer + BigInt(UObject.Name));
      outers.unshift(getName(outerNameIdx));
      outer = rl.uPtr(outer + BigInt(UObject.Outer));
    }

    const path = outers.length > 0 ? outers.join('.') + '.' + name : name;
    return `${className} ${path}`;
  } catch {
    return "<error>";
  }
}

/**
 * Find all objects of a specific class.
 *
 * This iterates through GObjects (up to MAX_OBJECTS) and filters by class name.
 *
 * @param className - The class name to search for
 * @yields Object pointer and full name
 */
function* findByClass(className: string): Generator<{ ptr: bigint; fullName: string }> {
  const MAX_OBJECTS = 500_000;

  for (let i = 0; i < MAX_OBJECTS; i++) {
    try {
      // GObjects is an array of pointers, 8 bytes each
      const ptr = rl.uPtr(gObjectsPtr + BigInt(i) * 8n);
      if (ptr === 0n) continue;

      // Check if this object is the class we want
      if (getClassName(ptr) === className) {
        yield { ptr, fullName: getObjectFullName(ptr) };
      }
    } catch {
      // Skip unreadable objects
    }
  }
}

// =============================================================================
// SDK TYPE USAGE EXAMPLE
// =============================================================================

/**
 * Read an FVector struct from memory.
 *
 * FVector is a Core struct - see: structs/Core.ts
 * Layout: { X: f32, Y: f32, Z: f32 } at offsets 0x00, 0x04, 0x08
 *
 * @param address - Memory address of the FVector
 * @returns FVector object with X, Y, Z components
 */
function readFVector(address: bigint): Structs.Core.FVector {
  const v = rl.vector3(address);
  return { X: v.x, Y: v.y, Z: v.z };
}

// =============================================================================
// MAIN: FIND AND DISPLAY BOOST AMOUNTS
// =============================================================================

console.log('Searching for CarComponent_Boost_TA objects...');
console.log('(Make sure you are in a match to see results)');
console.log();

let found = 0;
for (const { ptr, fullName } of findByClass('CarComponent_Boost_TA')) {
  // Read boost values using the offsets from classes/TAGame.ts
  const currentBoost = rl.f32(ptr + BigInt(BoostOffsets.CurrentBoostAmount));
  const maxBoost = rl.f32(ptr + BigInt(BoostOffsets.MaxBoostAmount));
  const percentage = maxBoost > 0 ? (currentBoost / maxBoost * 100).toFixed(1) : "0";

  console.log(`Found: ${fullName}`);
  console.log(`  Address: 0x${ptr.toString(16).toUpperCase()}`);
  console.log(`  Boost: ${currentBoost.toFixed(2)} / ${maxBoost.toFixed(2)} (${percentage}%)`);
  console.log();
  found++;
}

if (found === 0) {
  console.log('No boost components found.');
  console.log('Make sure you are in a match (not main menu or replay).');
} else {
  console.log(`Total: ${found} boost component(s) found`);
}

// Clean up
rl.close();
