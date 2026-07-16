# Controls ↔ physics map

Maps goal wording to code fields in this real-time WebGPU sim.

| Goal wording | Code | Free in UI? | Notes |
|--------------|------|-------------|-------|
| Mass \(M\) | `params.mass` | Yes | Scale; scale-free cam keeps angular size |
| Spin \(a\) (−1…+1) | `params.spinStar` | Yes signed \(\pm0.998\) | Default **+0.9** |
| Charge \(Q\) | `params.charge` | Yes | RN/KN on rays |
| Density \(\rho_0\) | via `disk.mdot` | Via ṁ | \(F\propto\dot m\), dens OD scales with ṁ |
| \(H/r\) | derived `thinDiskScaleHeight` | No (derived) | From ṁ + \(r_\mathrm{ISCO}/M\) + expert \(\Gamma\) |
| \(\Gamma\) | `disk.gamma` | Expert | 4/3 or 5/3 → H/R |
| Plasma \(\beta\) | `disk.plasmaBeta` | Expert | MRI dens variance scale |
| Inner radius | family ISCO | No (derived) | `diskIsco` + orbit sense |
| Disk tilt | `disk.tiltRad`, `tiltNodeRad` | Yes | Midplane vs spin (+Y) |
| Jets | `disk.jetPower` | Yes optional | \(\propto a_★^2 \dot m^{0.4}\) funnel |
| Orbit sense | `disk.prograde` | Yes secondary | Co-rot vs counter-rot L |

## Defaults

- \(M=1\), \(a_★=+0.9\), \(Q=0\), \(\dot m=0.1\), tilt=0, jet=0, \(\Gamma=5/3\), \(\beta=10\)

## Pipeline

UI → `setParams` / `setDisk` → `sceneBridge.applyPhysics` → `tracer.setSpacetime` → TSL RT

## Approximations

See [limitations.md](./limitations.md).
