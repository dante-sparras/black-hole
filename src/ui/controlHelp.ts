/**
 * Educational blurbs for each free control (and numerics).
 * Shown in 🛈 hover/click cards — keep concise, realism-first.
 * ṁ is not free: shown on derived HUD only (presets/scenario).
 */

export type ControlHelp = {
  /** Short title for the card header */
  title: string
  /** One-line summary */
  summary: string
  /** Longer body (plain text; newlines ok) */
  body: string
}

/** Keys match data-help attributes on control info buttons. */
export const CONTROL_HELP: Record<string, ControlHelp> = {
  mass: {
    title: 'Mass M',
    summary: 'Black-hole mass in geometric units (G = c = 1).',
    body: `M sets the overall scale of horizons, ISCO, and the disk in geometric lengths.

With scale-free camera ON (default), distance is d·M so the angular size of the shadow stays roughly constant when you change M — mass is a pure scale.

With scale-free OFF, fixed geometric D makes a heavier hole larger on screen.`,
  },
  spin: {
    title: 'Spin a★',
    summary: 'Dimensionless spin a★ = J/M² (signed).',
    body: `Range ≈ −0.998…+0.998 (default +0.9). Kerr length a = a★·M.

Sign sets rotation sense and which way the disk co-rotates (L ‖ J). Magnitude shrinks the prograde ISCO and photon orbit, warps the shadow, and enables frame-drag / jet power.

Negative a★ is the Retrograde preset sense — spin reversed, disk still co-rotating.`,
  },
  charge: {
    title: 'Charge Q',
    summary: 'Electric charge (Reissner–Nordström / Kerr–Newman).',
    body: `With a★≈0 this is RN; with both spin and charge, Kerr–Newman.

Q shrinks the horizon and photon sphere and changes ray capture. Extremality enforces M² ≥ a² + Q² — excess charge is clamped so the hole never goes naked.

Default Q = 0 (pure Kerr / Schwarzschild).`,
  },
  rho0: {
    title: 'ρ₀ dens',
    summary: 'Density normalization for volume opacity / dens weight.',
    body: `Free dens scale for how optically thick the disk volume looks (relative dens / OD).

Higher ρ₀ → denser-looking midplane and stronger extinction. Lower → thinner, more transparent volume. Mild relative T scale from ρ₀ (poly-like).

Eddington ratio ṁ is not free here — it is a scenario/preset expert readout on the derived HUD (as in real sims where ṁ is measured, not dialed).`,
  },
  beta: {
    title: 'β₀ plasma',
    summary: 'Plasma β = p_gas / p_mag seed (turbulence & MAD/SANE class).',
    body: `High β (gas-dominated) → quieter dens / SANE-like. Low β → stronger MRI-scale turbulence and MAD-class boosts in the model.

Derived only (HUD): magnet class, MRI variance, and perturbation amplitude. Not a free H/r or structure master.`,
  },
  outer: {
    title: 'r_out / M',
    summary: 'Outer luminous disk radius in units of M.',
    body: `Cutoff for the thin-disk emission and volume sampling. Larger r_out → bigger radial extent of the disk.

Inner edge is not free — it is the co-rotating ISCO from (M, a★, Q). Keep r_out well inside the camera distance so the disk does not become a solid “dome” at high inclination.`,
  },
  tilt: {
    title: 'Tilt',
    summary: 'Disk midplane tilt relative to the BH spin axis (+Y).',
    body: `Rotates the disk plane only (dens / midplane), not the hole’s spin. Spin stays along +Y; geodesics still use that axis.

0° = equatorial XZ disk. Up to ~40° for a warped/inclined look. Line of nodes is fixed (node = 0) in this build.`,
  },
  jet: {
    title: 'Jet boost',
    summary: 'User scale on the analytic polar funnel (jets).',
    body: `0 = off (default). Raises a simple BZ-like funnel glow ∝ a★² · ṁ^{0.4} · boost.

ṁ itself is scenario/preset (HUD). This slider is the optional multiplier. No emission inside the capture silhouette.`,
  },
  dist: {
    title: 'Distance / M',
    summary: 'Observer distance in units of M (scale-free d).',
    body: `With scale-free ON (default): slider is d such that D = d·M — angular lensing is mass-invariant.

With scale-free OFF: slider is absolute geometric D. Drag the canvas to orbit; wheel/pinch to zoom when available.`,
  },
  inc: {
    title: 'Inclination',
    summary: 'Polar angle from the spin axis (+Y).',
    body: `0° ≈ face-on (disk as a ring/annulus). ~70° default edge-on-ish cinematic. 90° edge-on.

Affects Doppler L/R contrast, apparent thickness, and how much far-side disk you see.`,
  },
  azim: {
    title: 'Azimuth',
    summary: 'Longitude around the spin axis.',
    body: `Rotates the camera around +Y. Combined with inclination, sets which side of the disk is approaching vs receding (Doppler blue/red).`,
  },
  fov: {
    title: 'FOV',
    summary: 'Half-screen ray scale (field of view lever).',
    body: `Larger FOV → wider angular view, smaller hole on screen. Smaller FOV → telephoto zoom on the shadow and photon ring.

Independent of Distance; both change framing.`,
  },
  quality: {
    title: 'Quality',
    summary: 'Numerics only — steps, DPR, volume stride (not physics laws).',
    body: `Low: fewer steps, lower DPR — better FPS.
Med: default interactive balance.
High: more steps / finer stride for the photon ring.

Never changes κ, NT law, g³, or dens model — only integration resolution.`,
  },
  grmhd: {
    title: 'Density source',
    summary: 'Analytic dens field vs loaded GRMHD-like cube.',
    body: `Analytic: sech² volume + structure model (always available).

GRMHD cube: samples a .bhcm 3D dens texture (demo cube is synthetic, not a published dump) when loaded. Mix/advection follow the material frame.

Switching does not change geodesic physics — only how volume density is sampled.`,
  },
}

export function getControlHelp(id: string): ControlHelp | undefined {
  return CONTROL_HELP[id]
}
