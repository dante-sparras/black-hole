# Limitations (honest scope)

This is a **best-effort real-time GR-inspired visualization**, not a production GRMHD code.

## What is solid

- No-hair parameters \((M, a_★, Q)\) with Schwarzschild / Kerr / RN / Kerr–Newman routing
- **Signed** dimensionless spin \(a_★ \in [-0.998, +0.998]\)
- Real-time null force (Cartesian RT) + optional Boyer–Lindquist Mino integrator
- Thin-disk Page–Thorne / Novikov–Thorne emission, \(I \propto g^3\), blackbody color
- Doppler + orbiting redshift, pure-black capture voids
- Optional disk **tilt**, optional **jets** (analytic funnel), expert \(\Gamma\) / plasma \(\beta\)

## Approximations

| Area | Reality |
|------|---------|
| Kerr RT force | Approximate (tagged `kerr-RT~` / `kn-RT~`); not full numerical geodesic GRMHD |
| BL charge | Kerr-form \(\Delta\) when \(Q\neq0\) (tags `*-BL~`) |
| Disk dens | Analytic sech² volume ± synthetic `.bhcm` demo cube — **not** a live published GRMHD dump unless you convert one |
| Jets | Analytic polar funnel \(\propto a_★^2 \dot m^{0.4}\), not Blandford–Znajek MHD |
| \(\Gamma\), \(\beta\) | Effective proxies into H/R and dens variance — not full EOS/MHD |
| Inner edge | Locked to family ISCO (thin-disk equilibrium) |
| FPS | Quality L/M/H trades steps/DPR/stride; target ~45–60 FPS on modern GPUs |

## Not claimed

- Full time-dependent GRMHD
- Polarized multi-frequency GRRT science products
- Exact EHT data reduction fidelity

## Safety / revert

Branch `safety/pre-goal-plan-eae1eef` freezes the pre-goal thin-band look commit.
