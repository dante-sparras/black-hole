# Controls ↔ physics map

| Goal wording | Code | UI | Effect |
|--------------|------|-----|--------|
| Mass \(M\) | `params.mass` | BH | Scale |
| Spin \(a_★\) | `params.spinStar` | BH signed ±0.998 | Rays, ISCO, jets |
| Charge \(Q\) | `params.charge` | BH | RN/KN |
| \(\dot m\) | `disk.mdot` | Disk | NT power / T |
| Density \(\rho_0\) | `disk.rho0` | Disk | Dens weight + OD |
| Aspect \(H/r\) | `disk.scaleHeight` | Disk **free** | Volume thickness |
| \(\Gamma\) | `disk.gamma` | Disk | EOS; thin H/r ref + poly T |
| \(K\) polytrope | `disk.polyK` | Disk | \(T\propto K\rho^{\Gamma-1}\) proxy |
| \(\ell\) ang. mom. | `disk.specificL` | Disk | Dens peak radius (FM-like) |
| \(\beta_0\) | `disk.plasmaBeta` | Disk | MRI dens variance |
| B geometry | `disk.magGeometry` | Disk | single/multi/vertical dens mod |
| Magnetization | `disk.magnetState` | Disk | SANE / MAD |
| \(r_\mathrm{in}\) | `disk.rinM` + `rinFree` | Disk | Free or ISCO-locked |
| \(r_\mathrm{out}\) | `disk.outerM` | Disk | Outer luminous edge |
| Orbit | `disk.prograde` | Disk | Co/counter-rot |
| Tilt | `disk.tiltRad`, `tiltNodeRad` | Disk | Midplane vs spin |
| Perturb | `disk.perturbAmp` | Disk | Turbulence seed |
| Jets | `disk.jetPower` | Disk | Funnel \(\propto a_★^2\dot m\) |

All disk base properties live in **one** Accretion disk panel (no expert submenu).

Approximations: [limitations.md](./limitations.md).
