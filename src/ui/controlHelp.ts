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

Higher ρ₀ → denser midplane and stronger extinction. Mild relative T scale from ρ₀^Γ⁻¹.

ṁ is scenario/preset (HUD), not free.`,
  },
  scaleH: {
    title: 'H/r',
    summary: 'Disk aspect ratio (scale height over radius).',
    body: `Free vertical thickness of the volume dens. Larger H/r → puffier disk, stronger polar path length, more “fat torus” look.

In pure thin-disk theory H/r is often derived from ṁ and Γ; here it is an expert free base so you can set geometry independently of the ṁ scenario.`,
  },
  gamma: {
    title: 'Γ (adiabatic index)',
    summary: 'Equation-of-state index for the gas.',
    body: `Typical range 4/3 (radiation-dominated soft) … 5/3 (non-relativistic gas). Affects poly-like T scale from ρ₀ and (in theory) disk structure.

Default 5/3. Not a free temperature dial — use ρ₀ / scenario ṁ for brightness.`,
  },
  beta: {
    title: 'β₀ plasma',
    summary: 'Plasma β = p_gas / p_mag seed (turbulence & MAD/SANE class).',
    body: `High β (gas-dominated) → quieter dens / SANE-like. Low β → stronger MRI-scale turbulence and MAD-class boosts.

HUD shows MAD/SANE class and MRI scale derived from β₀.`,
  },
  rin: {
    title: 'r_in / M',
    summary: 'Free luminous inner edge (not forced to ISCO).',
    body: `Inner cutoff of the emitting disk in units of M. Floored above ~1.05 r₊ and below r_out.

ISCO is still computed and shown on the HUD as a reference (Δr_in). For classical thin NT, r_in = ISCO is most physical; free r_in is the expert torus-style lever.

ℓ̃ ≈ √(r_in/M) is derived on the HUD from this value.`,
  },
  outer: {
    title: 'r_out / M',
    summary: 'Outer luminous disk radius in units of M.',
    body: `Cutoff for emission and volume sampling. Larger r_out → bigger radial extent.

Keep r_out well inside camera distance at high inclination to avoid a solid “dome.” Shrinking r_out re-clamps r_in if needed.`,
  },
  tilt: {
    title: 'Tilt',
    summary: 'Disk midplane tilt relative to the BH spin axis (+Y).',
    body: `Rotates the disk plane only (dens / midplane), not the hole’s spin. Spin stays along +Y.

0° = equatorial XZ. Up to ~40°. Line of nodes fixed (node = 0).`,
  },
  jet: {
    title: 'Jet strength',
    summary: 'Scale on the analytic polar funnel (magnetic/jet proxy).',
    body: `0 = off (default). Funnel glow ∝ a★² · ṁ^{0.4} · strength.

Educational BZ-like jet, not full GRMHD. ṁ is scenario/preset; this is the free multiplier. No emission inside the capture silhouette.`,
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
