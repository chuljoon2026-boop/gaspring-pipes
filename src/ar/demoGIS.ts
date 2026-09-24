import { FACILITIES } from '../network'

/** Local GIS fixture, in metres. Origin is the first viewer position projected
 * onto the ground; -Z is the initial forward direction (not surveyed north).
 * Relocate the existing drawing once, never relative to subsequent hit points.
 */
export const DEMO_GIS = {
  reference: 'GP-001',
  drawingOffset: [7, 0, 3] as [number, number, number],
  cameraHeight: 1.4,
  referencePosition: [0, FACILITIES['GP-001'].anchor[1], -4] as [number, number, number],
}
