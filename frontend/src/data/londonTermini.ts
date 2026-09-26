// London terminus CRS codes where TfL lines are relevant
const LONDON_TERMINI = new Set([
  'BFR', // London Blackfriars
  'CST', // London Cannon Street
  'CHX', // London Charing Cross
  'CTK', // City Thameslink
  'EUS', // London Euston
  'FST', // London Fenchurch Street
  'KGX', // London Kings Cross
  'LST', // London Liverpool Street
  'LBG', // London Bridge
  'MYB', // London Marylebone
  'MOG', // Moorgate
  'OLD', // Old Street
  'PAD', // London Paddington
  'STP', // London St Pancras International
  'VIC', // London Victoria
  'WAT', // London Waterloo
  'WAE', // London Waterloo East
]);

export function isLondonTerminus(crs: string): boolean {
  return LONDON_TERMINI.has(crs.toUpperCase());
}
