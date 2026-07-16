# Controls ↔ physics map (collapsed DiskParams)

## Free controls (user)

| Control | Code |
|---------|------|
| Mass \(M\) | `params.mass` |
| Spin \(a_★\) signed | `params.spinStar` |
| Charge \(Q\) | `params.charge` |
| \(\dot m\) | `disk.mdot` |
| \(\rho_0\) | `disk.rho0` |
| \(\beta_0\) | `disk.plasmaBeta` |
| \(r_\mathrm{out}/M\) | `disk.outerM` |
| Tilt | `disk.tiltRad` |
| Jet **boost** | `disk.jetBoost` |
| Observer | camera |
| Quality / dens source | numerics |

## Model defaults (store, not free UI)

`structure`, `arms`, `clumps`, `dust`, `shearRate`, `animate` — presets may set (e.g. NT smooth).

## Derived only (not stored as free)

| Quantity | From |
|----------|------|
| Orbit | always co-rotating (L ‖ J); direction from **sign(a★)** |
| \(r_\mathrm{in}\) | co-rot ISCO |
| \(H/r\) | `thinDiskScaleHeight(ṁ, r_in/M, Γ=5/3)` |
| \(\Gamma\) | fixed **5/3** (`DISK_GAMMA`) |
| \(\ell\tilde{}\) | \(\sqrt{r_\mathrm{in}/M}\) |
| SANE/MAD | \(\beta_0 < 10\) → MAD |
| Perturb | from \(\beta_0\) |
| jet_eff | \(a_★^2 \dot m^{0.4}\) · jetBoost |

See [limitations.md](./limitations.md).
