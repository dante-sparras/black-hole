# Controls ↔ physics map (thin-disk trim)

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
| Jet **boost** 0…1 | `disk.jetPower` |
| Observer | camera |
| Quality / dens source | numerics |

## Derived only (HUD / model — not sliders)

| Quantity | From |
|----------|------|
| Orbit | always **co-rotating** (L ‖ J); direction from **sign(a★)** |
| \(r_\mathrm{in}\) | = ISCO(\(M,a_★,Q\), co-rot) |
| \(H/r\) | `thinDiskScaleHeight(ṁ, r_in/M, Γ=5/3)` |
| \(\Gamma\) | fixed **5/3** |
| \(\ell\tilde{}\) | \(\sqrt{r_\mathrm{in}/M}\) |
| \(r_\mathrm{peak}\) | from \(\ell\) |
| SANE/MAD class | \(\beta_0 < 10\) → MAD else SANE |
| Perturb | from \(\beta_0\) |
| B geometry | fixed single-loop |
| Tilt node | fixed 0 |
| jet_eff | \(a_★^2 \dot m^{0.4}\) · boost |
| \(r_+\), \(r_\mathrm{ph}\), \(\eta\), \(b_c\), … | metric / NT |

See [limitations.md](./limitations.md).
