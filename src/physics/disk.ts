/**
 * Thin accretion disk facade — re-exports split modules for stable import path.
 *
 * | Module | Responsibility |
 * |--------|----------------|
 * | diskIsco | Family ISCO / r_in |
 * | diskEmission | NT/PT flux, T(r), η, H/R, Ω, DISK_EMISSION |
 * | diskDisplay | Eye curves, beam, ṁ brightness, log sliders |
 *
 * Prefer importing from the specific module in new code; `./disk` remains valid.
 */
export { rnIsco, diskIsco } from './diskIsco'
export {
  T_PEAK_REF_K,
  T_PEAK_MDOT_REF,
  R_ISCO_SCHW_OVER_M,
  DISK_EMISSION,
  novikovThorneFluxFactor,
  pageThorneFluxFactor,
  kerrCircularEnergy,
  novikovThorneEfficiency,
  novikovThornePeakRadius,
  pageThornePeakRadius,
  alphaDiskMidplane,
  diskPeakTemperatureK,
  densRestTemperatureK,
  diskTemperatureK,
  observedTemperatureK,
  thinDiskScaleHeight,
  kerrCircularOmega,
  novikovThorneTemperature,
} from './diskEmission'
export {
  autoExposureFromPhysics,
  colorRedshiftFactor,
  beamIntensityExponent,
  beamIntensityFloor,
  beamIntensity,
  clampDiskColorTemperatureK,
  mdotTemperatureScale,
  mdotDisplayBrightness,
  mdotFluxScale,
  mdotFromSlider,
  sliderFromMdot,
} from './diskDisplay'
