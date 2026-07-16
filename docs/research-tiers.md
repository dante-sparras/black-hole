# Research tiers (real-time vs offline)

## Implemented in interactive GRRT (this repo)

| Tier | Feature | Notes |
|------|---------|--------|
| 1 | Multi-image isolation | τ decay outside slab; secondary weight |
| 1 | Honest \(g\) | Low floors; \(g^1\) color |
| 1 | Critical + photon-sphere adapt | Finer steps near \(b_c\), \(r_\mathrm{ph}\) |
| 1 | PT peak radius | Kerr \(F_\mathrm{max}\) search (CPU) / spin-scaled (GPU) |
| 2 | α-disk midplane + \(H/R\) | Gas/rad branches; auto exposure \(\eta\cdot\dot m\) |
| 2 | Optical-depth limb darkening | \(I\propto 1-e^{-\tau_0/\mu}\) |
| 2 | Lense–Thirring dens wind | \(\propto a/r^3\) |
| 2 | BL volume samples | Equator slab + Kerr \(\Omega\) |
| 2 | NT smooth preset | `structure=0` pure theory |
| 3 | 5-band blackbody chroma | Better than 3-λ RGB |
| 3 | Corona optical proxy | Dilute hot layer above inner disk |
| 3 | GRMHD-like dens | Log-normal multi-scale (not a real cube) |

## Explicitly offline / not yet in the renderer

| Item | Why offline |
|------|-------------|
| **True GRMHD density cube** (HARM/BHAC/Athena++) | Needs sim dump + 3D texture pipeline |
| **Full polarized GRRT** (ipoole/BHOSS) | Stokes transfer; large codepath |
| **Multi-frequency SI transfer** | Tables + many ν samples; not interactive RGB |
| **Self-consistent jet MHD** | Full GRMHD + radiation |

### Path to real GRMHD cubes (future)

1. Export density/velocity cube from GRMHD (HDF5).  
2. Upload as 3D WebGPU texture (float).  
3. Sample dens in RT instead of analytic sech²×spiral.  
4. Keep geodesic + PT temperature or use GRMHD internal energy.

### Polarization (future)

Stokes \(I,Q,U,V\) along geodesic with Faraday rotation — separate science product.
