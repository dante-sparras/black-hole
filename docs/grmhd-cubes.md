# GRMHD density cubes

## Goal

Volume dens from a **real 3D field** (not only analytic sech² × noise).

## Runtime format: `.bhcm`

Little-endian binary (see `src/physics/grmhdCube.ts`):

| Field | Type |
|-------|------|
| magic | `BHCM` u32 |
| version | u32 = 1 |
| nx, ny, nz | u32 |
| origin xyz | f32 × 3 (box min, units of **M**) |
| extent xyz | f32 × 3 (box size, units of **M**) |
| densScale | f32 |
| data | nx×ny×nz f32, **x fastest**, then y, then z |

Coords match the sim: **+Y = spin**, disk in **XZ**.

## Browser path

1. `bun run scripts/gen-grmhd-cube.ts` → `public/cubes/demo.bhcm`
2. App loads `/cubes/demo.bhcm` on boot (if present)
3. Numerics → **Density: GRMHD cube** enables GPU `texture3D` sampling
4. Mix 0…1 blends analytic ↔ cube

## Real HARM / BHAC dumps

True science cubes need an offline convert:

1. Read HDF5 dens (and optional internal energy)
2. Interpolate onto a Cartesian box in geometric units
3. Normalize peak dens ~ 1
4. Write `.bhcm` with the header above

`scripts/convert-harm-stub.ts` documents the roundtrip; full HDF5 conversion is usually **Python + h5py** (not in the browser).

## GPU (WebGPU)

`Data3DTexture` as **R8 UNORM** (not R32F — float filter often black-screens).

TSL sample (required form):

```js
const cubeNode = texture3D(data3DTexture)
const dens = cubeNode.sample(uvw).r
```

Boot loads `/cubes/demo.bhcm` with **mix=0** (analytic). Numerics → **GRMHD cube** sets mix=1.

Soft box mask: \(\max(1-|2u-1|,0)\) product — no `greaterThanEqual` chains.


## Honesty

- **demo.bhcm** from `synthesizeGrmhdLikeCube` is a **GRMHD-like** field (spirals + MRI + sech²), not a published dump.
- Drop a converted real dump at `public/cubes/demo.bhcm` (or load another URL) for true GRMHD dens.
