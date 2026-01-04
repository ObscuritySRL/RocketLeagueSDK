/**
 * Basic SDK Usage Example
 *
 * This example demonstrates how to read and write game data from Rocket League
 * using the generated SDK types and offsets.
 *
 * Run with: bun run examples/basic.ts
 */

import Memory from "bun-memory";

import { GNames, GObjects } from "rocketleaguesdk/types/offsets";
import { Object_ as UObject, FNameEntry } from "rocketleaguesdk/offsets/Core";
import {
  GFxNameplatesManager_TA,
  GFxData_Nameplate_TA,
  NameplateComponentCar_TA,
  Vehicle_TA,
  CarComponent_Boost_TA,
} from "rocketleaguesdk/offsets/TAGame";

// Attach to the Rocket League process and get the main module
const rl = new Memory("RocketLeague.exe");
const module = rl.modules["RocketLeague.exe"];

if (module === undefined) {
  throw new Error("module must not be undefined.");
}

// Lookup tables for caching resolved names and object pointers
const fNameToGObjectPtrs: Map<string, bigint[]> = new Map<string, bigint[]>(),
      gObjectClassNameToFName: Map<number, string> = new Map<number, string>(),
      gObjectClassPtrToFName: Map<bigint, string> = new Map<bigint, string>(); // prettier-ignore

// Read the global name and object arrays from memory
const gNamePtrs = rl.tArrayUPtr(module.base + GNames),
      gObjectPtrs = rl.tArrayUPtr(module.base + GObjects); // prettier-ignore

// Build a mapping from class names (FNames) to their object pointers
// This iterates through all GObjects and resolves their class names
for (const gObjectPtr of gObjectPtrs) {
  if (gObjectPtr === 0n) {
    continue;
  }

  const gObjectClassPtr = rl.uPtr(gObjectPtr + BigInt(UObject.Class));

  let gName = gObjectClassPtrToFName.get(gObjectClassPtr);

  if (gName === undefined) {
    const gObjectClassName = rl.i32(gObjectClassPtr + BigInt(UObject.Name));

    gName = gObjectClassNameToFName.get(gObjectClassName);

    if (gName === undefined) {
      const gNamePtr = gNamePtrs[gObjectClassName];

      if (gNamePtr === 0n) {
        continue;
      }

      gName = rl.wideString(gNamePtr + BigInt(FNameEntry.Name), 0x400);

      gObjectClassPtrToFName.set(gObjectClassPtr, gName);
      gObjectClassNameToFName.set(gObjectClassName, gName);
    } else {
      gObjectClassPtrToFName.set(gObjectClassPtr, gName);
    }
  }

  let gObjectPtrs_ = fNameToGObjectPtrs.get(gName);

  if (gObjectPtrs_ === undefined) {
    gObjectPtrs_ = [];
    fNameToGObjectPtrs.set(gName, gObjectPtrs_);
  }

  gObjectPtrs_.push(gObjectPtr);
}

let ticks = 0;

// Main loop: reads nameplate data and updates boost display for each car
function tick() {
  ticks++;

  try {
    const gfxNameplatesManager_TAPtrs = fNameToGObjectPtrs.get(
      "GFxNameplatesManager_TA"
    );

    if (!gfxNameplatesManager_TAPtrs?.length) {
      return;
    }

    for (const gfxNameplatesManager_TAPtr of gfxNameplatesManager_TAPtrs) {
      const uGFxData_Nameplate_TAPtrs = rl.tArrayUPtr(
        gfxNameplatesManager_TAPtr +
          BigInt(GFxNameplatesManager_TA.NameplateRows)
      );

      for (const uGFxData_Nameplate_TAPtr of uGFxData_Nameplate_TAPtrs) {
        const uNameplateComponentCar_TA = rl.uPtr(
          uGFxData_Nameplate_TAPtr +
            BigInt(GFxData_Nameplate_TA.NameplateComponent)
        );

        if (uNameplateComponentCar_TA === 0n) {
          continue;
        }

        const uCarPtr = rl.uPtr(
          uNameplateComponentCar_TA + BigInt(NameplateComponentCar_TA.Car)
        );

        if (uCarPtr === 0n) {
          continue;
        }

        const uCarComponent_Boost_TAPtr = rl.uPtr(
          uCarPtr + BigInt(Vehicle_TA.BoostComponent)
        );

        if (uCarComponent_Boost_TAPtr === 0n) {
          continue;
        }

        const currentBoostAmount = rl.f32(
          uCarComponent_Boost_TAPtr +
            BigInt(CarComponent_Boost_TA.CurrentBoostAmount)
        );

        // Write the boost amount to the nameplate and enable boost rendering
        void rl.f32(
          uGFxData_Nameplate_TAPtr + BigInt(GFxData_Nameplate_TA.BoostAmount),
          currentBoostAmount
        );
        void rl.u32(
          uGFxData_Nameplate_TAPtr +
            BigInt(GFxData_Nameplate_TA.bRenderBoostAmount),
          0x20
        );
      }
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    setImmediate(tick);
  }
}

// Start the main loop
setImmediate(tick);

// Log tick rate every second for performance monitoring
setInterval(() => {
  console.clear();
  console.log("[RL] Ticks: %d", ticks);
  ticks = 0;
}, 1_000);
