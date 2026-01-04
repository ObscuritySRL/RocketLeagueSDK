# Rocket League TypeScript SDK

Auto-generated TypeScript type definitions for Rocket League's Unreal Engine 3 classes, structs, enums, and constants.

## Installation

```bash
bun add rlsdk bun-memory
```

## Usage

This SDK provides type definitions and offset constants for use with memory reading libraries like `bun-memory`.

```typescript
import Memory from 'bun-memory';
import { GNames, GObjects } from 'rlsdk/offsets';
import { Object_ as UObject, FNameEntry } from 'rlsdk/offsets/Core';
import { CarComponent_Boost_TA } from 'rlsdk/offsets/TAGame';

// Connect to Rocket League
const rl = new Memory('RocketLeague.exe');
const module = rl.modules['RocketLeague.exe'];

// Read GNames and GObjects arrays
const gNamePtrs = rl.tArrayUPtr(module.base + GNames);
const gObjectPtrs = rl.tArrayUPtr(module.base + GObjects);

// Read boost amount using exported offsets
const boostAmount = rl.f32(boostComponentPtr + CarComponent_Boost_TA.CurrentBoostAmount);
```

See the `examples/` directory for a complete working example.

## Understanding the Type Comments

Each property includes a comment with memory layout information:

```typescript
export type UCarComponent_Boost_TA = UCarComponent_TA & {
  MaxBoostAmount: number;      // 0x032c (0x0004) [float]
  CurrentBoostAmount: number;  // 0x0338 (0x0004) [float]
};
```

- `0x032c` - Offset from the start of the object in memory
- `0x0004` - Size of the property in bytes
- `[float]` - Native C++ type (helps choose the correct memory read method)

### Native Type to Memory Method Mapping

| Native Type | Size | Memory Method |
|-------------|------|---------------|
| `int32` | 4 | `rl.i32()` |
| `uint32` | 4 | `rl.u32()` |
| `uint8` | 1 | `rl.u8()` |
| `uint64` | 8 | `rl.u64()` |
| `float` | 4 | `rl.f32()` |
| `FString` | 16 | Custom (pointer to wide string) |
| `FName` | 8 | `rl.i32()` for index |
| `FVector` | 12 | `rl.vector3()` |
| `TArray<T>` | 16 | Custom (pointer + count + capacity) |
| `SomeClass*` | 8 | `rl.uPtr()` |

### Boolean Bitfields

UE3 packs multiple boolean properties into single `uint32_t` values. When you see multiple bools at the same offset with different bitmasks, they share a bitfield:

```typescript
export type UGFxData_Nameplate_TA = UGFxDataRow_X & {
  bHideFullNameplate: boolean;   // 0x00bc (0x0004) [bool : 0x1]
  bIsTargetLocked: boolean;      // 0x00bc (0x0004) [bool : 0x2]
  bInKnockoutGameMode: boolean;  // 0x00bc (0x0004) [bool : 0x4]
  bIsDistracted: boolean;        // 0x00bc (0x0004) [bool : 0x8]
};
```

To read a bitfield bool:
```typescript
const bitfield = rl.u32(objectAddr + 0x00bcn);
const bHideFullNameplate = (bitfield & 0x1) !== 0;
const bIsTargetLocked = (bitfield & 0x2) !== 0;
const bInKnockoutGameMode = (bitfield & 0x4) !== 0;
```

To write a bitfield bool:
```typescript
let bitfield = rl.u32(objectAddr + 0x00bcn);
// Set bIsTargetLocked to true
bitfield |= 0x2;
// Set bIsTargetLocked to false
bitfield &= ~0x2;
rl.writeU32(objectAddr + 0x00bcn, bitfield);
```

When a bool has `[bool : 0x1]` and is at a unique offset, it's a standalone `uint32_t` bool (not packed).

## SDK Structure

```
rlsdk/
├── classes/          # UClass definitions (game objects)
│   ├── Core.ts
│   ├── Engine.ts
│   ├── TAGame.ts     # Rocket League specific classes
│   └── ...
├── structs/          # UStruct definitions (data structures)
│   ├── Core.ts
│   ├── Engine.ts
│   └── ...
├── enums/            # UEnum definitions
│   ├── Core.ts
│   ├── Engine.ts
│   └── ...
├── constants/        # UConst definitions
├── parameters/       # Function parameter structs
├── types/            # Core type definitions
└── index.ts          # Main entry point
```

## Key Classes

### TAGame Package (Rocket League)

- `UCarComponent_Boost_TA` - Boost component with current/max boost
- `UCarComponent_Dodge_TA` - Dodge/flip state
- `UCarComponent_Jump_TA` - Jump state
- `UBall_TA` - Ball object
- `UCar_TA` - Car object
- `UPRI_TA` - Player replication info
- `UGameEvent_Soccar_TA` - Match state

### Engine Package (Unreal Engine)

- `UObject` - Base class for all objects
- `UActor` - Base class for placed objects
- `UPawn` - Base class for controllable entities
- `UPlayerController` - Player input handling

## Finding Objects in Memory

The SDK types describe object layouts, but you need GObjects/GNames to find objects:

1. **GObjects** - Global array of all UObject instances
2. **GNames** - Global array of FName strings

See the `examples/` directory for working code examples.

## Version Compatibility

This SDK was generated for a specific version of Rocket League. Game updates may change:
- Property offsets
- Class sizes
- New/removed properties

Regenerate the SDK after game updates using the generator tool.

## License

MIT
