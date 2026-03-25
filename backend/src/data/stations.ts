export interface Station {
  crs: string;
  name: string;
  lat: number;
  lon: number;
}

// Static lookup of National Rail stations — CRS code → name + coordinates.
// Sourced from community-maintained RDG open data station list.
// To update: replace entries from the latest NaPTAN/RDG dataset.
const stationsArray: Station[] = [
  { crs: 'ABW', name: 'Abbey Wood', lat: 51.4907, lon: 0.1203 },
  { crs: 'ABD', name: 'Aberdeen', lat: 57.1437, lon: -2.0985 },
  { crs: 'ACT', name: 'Acton Main Line', lat: 51.5170, lon: -0.2672 },
  { crs: 'ADM', name: 'Adderley Park', lat: 52.4841, lon: -1.8546 },
  { crs: 'AGT', name: 'Airdrie', lat: 55.8610, lon: -3.9797 },
  { crs: 'ALV', name: 'Alvechurch', lat: 52.3500, lon: -1.9667 },
  { crs: 'AMR', name: 'Amersham', lat: 51.6741, lon: -0.6073 },
  { crs: 'ANG', name: 'Angel Road', lat: 51.6125, lon: -0.0490 },
  { crs: 'APD', name: 'Appledore', lat: 51.0292, lon: 0.8242 },
  { crs: 'AFK', name: 'Ashford International', lat: 51.1432, lon: 0.8764 },
  { crs: 'AHD', name: 'Ashtead', lat: 51.3155, lon: -0.3070 },
  { crs: 'AYS', name: 'Aylesbury', lat: 51.8137, lon: -0.8143 },
  { crs: 'AYP', name: 'Aylesbury Vale Parkway', lat: 51.8324, lon: -0.8510 },
  { crs: 'BTN', name: 'Brighton', lat: 50.8290, lon: -0.1410 },
  { crs: 'BRI', name: 'Bristol Temple Meads', lat: 51.4490, lon: -2.5813 },
  { crs: 'BPW', name: 'Bristol Parkway', lat: 51.5134, lon: -2.5419 },
  { crs: 'BHM', name: 'Birmingham New Street', lat: 52.4778, lon: -1.9003 },
  { crs: 'BMO', name: 'Birmingham Moor Street', lat: 52.4790, lon: -1.8927 },
  { crs: 'BHI', name: 'Birmingham International', lat: 52.4509, lon: -1.7262 },
  { crs: 'BSK', name: 'Basingstoke', lat: 51.2680, lon: -1.0870 },
  { crs: 'BAN', name: 'Banbury', lat: 52.0605, lon: -1.3280 },
  { crs: 'BAT', name: 'Bath Spa', lat: 51.3777, lon: -2.3570 },
  { crs: 'BDM', name: 'Bedford', lat: 52.1361, lon: -0.4795 },
  { crs: 'BKG', name: 'Barking', lat: 51.5396, lon: 0.0809 },
  { crs: 'BMS', name: 'Beaconsfield', lat: 51.6106, lon: -0.6429 },
  { crs: 'BCF', name: 'Beaconsfield', lat: 51.6106, lon: -0.6429 },
  { crs: 'BEC', name: 'Beckenham Junction', lat: 51.4110, lon: -0.0259 },
  { crs: 'BKL', name: 'Bickley', lat: 51.3960, lon: 0.0449 },
  { crs: 'BLY', name: 'Bletchley', lat: 51.9948, lon: -0.7364 },
  { crs: 'BON', name: 'Bournemouth', lat: 50.7272, lon: -1.8640 },
  { crs: 'BXB', name: 'Broxbourne', lat: 51.7468, lon: -0.0114 },
  { crs: 'BRE', name: 'Brentford', lat: 51.4872, lon: -0.3089 },
  { crs: 'BRU', name: 'Bruton', lat: 51.1111, lon: -2.4502 },
  { crs: 'CBG', name: 'Cambridge', lat: 52.1940, lon: 0.1376 },
  { crs: 'CBN', name: 'Cambridge North', lat: 52.2253, lon: 0.1543 },
  { crs: 'CDF', name: 'Cardiff Central', lat: 51.4753, lon: -3.1782 },
  { crs: 'CTM', name: 'Chatham', lat: 51.3810, lon: 0.5220 },
  { crs: 'CLT', name: 'Cheltenham Spa', lat: 51.8960, lon: -2.0983 },
  { crs: 'CHM', name: 'Chelmsford', lat: 51.7360, lon: 0.4686 },
  { crs: 'CHP', name: 'Chippenham', lat: 51.4614, lon: -2.1160 },
  { crs: 'CLJ', name: 'Clapham Junction', lat: 51.4641, lon: -0.1703 },
  { crs: 'COL', name: 'Colchester', lat: 51.9003, lon: 0.8937 },
  { crs: 'COV', name: 'Coventry', lat: 52.4007, lon: -1.5148 },
  { crs: 'CRE', name: 'Crewe', lat: 53.0879, lon: -2.4316 },
  { crs: 'CRY', name: 'Crystal Palace', lat: 51.4180, lon: -0.0731 },
  { crs: 'CTK', name: 'City Thameslink', lat: 51.5139, lon: -0.1037 },
  { crs: 'DKG', name: 'Dorking', lat: 51.2344, lon: -0.3298 },
  { crs: 'DAR', name: 'Darlington', lat: 54.5203, lon: -1.5476 },
  { crs: 'DER', name: 'Derby', lat: 52.9161, lon: -1.4636 },
  { crs: 'DVP', name: 'Dover Priory', lat: 51.1265, lon: 1.3048 },
  { crs: 'DFD', name: 'Dartford', lat: 51.4480, lon: 0.2133 },
  { crs: 'EAL', name: 'Ealing Broadway', lat: 51.5150, lon: -0.3014 },
  { crs: 'EBN', name: 'Eastbourne', lat: 50.7708, lon: 0.2813 },
  { crs: 'ECR', name: 'East Croydon', lat: 51.3752, lon: -0.0923 },
  { crs: 'EDN', name: 'Edinburgh Waverley', lat: 55.9513, lon: -3.1903 },
  { crs: 'EDB', name: 'Edinburgh Waverley', lat: 55.9513, lon: -3.1903 },
  { crs: 'EGR', name: 'East Grinstead', lat: 51.1255, lon: -0.0163 },
  { crs: 'EPH', name: 'Elephant & Castle', lat: 51.4943, lon: -0.0989 },
  { crs: 'ELW', name: 'Elstree & Borehamwood', lat: 51.6529, lon: -0.2805 },
  { crs: 'EPM', name: 'Epsom', lat: 51.3345, lon: -0.2671 },
  { crs: 'EUS', name: 'London Euston', lat: 51.5282, lon: -0.1337 },
  { crs: 'EWR', name: 'Ewell West', lat: 51.3468, lon: -0.2505 },
  { crs: 'EXD', name: 'Exeter St Davids', lat: 50.7277, lon: -3.5444 },
  { crs: 'FPK', name: 'Finsbury Park', lat: 51.5643, lon: -0.1063 },
  { crs: 'FLT', name: 'Feltham', lat: 51.4460, lon: -0.4103 },
  { crs: 'FNB', name: 'Farnborough (Main)', lat: 51.2962, lon: -0.7564 },
  { crs: 'FST', name: 'London Fenchurch Street', lat: 51.5113, lon: -0.0790 },
  { crs: 'GLD', name: 'Guildford', lat: 51.2370, lon: -0.5901 },
  { crs: 'GLC', name: 'Glasgow Central', lat: 55.8598, lon: -4.2580 },
  { crs: 'GLQ', name: 'Glasgow Queen Street', lat: 55.8623, lon: -4.2514 },
  { crs: 'GRA', name: 'Gravesend', lat: 51.4413, lon: 0.3687 },
  { crs: 'GTW', name: 'Gatwick Airport', lat: 51.1564, lon: -0.1610 },
  { crs: 'HHE', name: 'Haywards Heath', lat: 51.0057, lon: -0.1056 },
  { crs: 'HRW', name: 'Harrow & Wealdstone', lat: 51.5922, lon: -0.3350 },
  { crs: 'HAT', name: 'Hatfield', lat: 51.7641, lon: -0.2165 },
  { crs: 'HGS', name: 'Hastings', lat: 50.8588, lon: 0.5779 },
  { crs: 'HIT', name: 'Hitchin', lat: 51.9527, lon: -0.2607 },
  { crs: 'HOR', name: 'Horsham', lat: 51.0678, lon: -0.3222 },
  { crs: 'HOV', name: 'Hove', lat: 50.8353, lon: -0.1714 },
  { crs: 'HML', name: 'Hemel Hempstead', lat: 51.7416, lon: -0.4887 },
  { crs: 'HST', name: 'London St Pancras International', lat: 51.5313, lon: -0.1262 },
  { crs: 'HUL', name: 'Hull', lat: 53.7435, lon: -0.3458 },
  { crs: 'IPS', name: 'Ipswich', lat: 52.0507, lon: 1.1443 },
  { crs: 'KGX', name: 'London Kings Cross', lat: 51.5308, lon: -0.1238 },
  { crs: 'KET', name: 'Kettering', lat: 52.3935, lon: -0.7316 },
  { crs: 'LBG', name: 'London Bridge', lat: 51.5049, lon: -0.0862 },
  { crs: 'LEI', name: 'Leicester', lat: 52.6312, lon: -1.1251 },
  { crs: 'LDS', name: 'Leeds', lat: 53.7959, lon: -1.5478 },
  { crs: 'LIV', name: 'Liverpool Lime Street', lat: 53.4072, lon: -2.9780 },
  { crs: 'LST', name: 'London Liverpool Street', lat: 51.5178, lon: -0.0823 },
  { crs: 'LTN', name: 'Luton', lat: 51.8823, lon: -0.4149 },
  { crs: 'LUT', name: 'Luton Airport Parkway', lat: 51.8716, lon: -0.3949 },
  { crs: 'MAN', name: 'Manchester Piccadilly', lat: 53.4772, lon: -2.2310 },
  { crs: 'MCV', name: 'Manchester Victoria', lat: 53.4877, lon: -2.2423 },
  { crs: 'MYB', name: 'London Marylebone', lat: 51.5225, lon: -0.1631 },
  { crs: 'MEV', name: 'Maidstone East', lat: 51.2727, lon: 0.5221 },
  { crs: 'MKC', name: 'Milton Keynes Central', lat: 52.0341, lon: -0.7747 },
  { crs: 'NCL', name: 'Newcastle', lat: 54.9686, lon: -1.6172 },
  { crs: 'NRW', name: 'Norwich', lat: 52.6267, lon: 1.3068 },
  { crs: 'NWX', name: 'New Cross', lat: 51.4763, lon: -0.0327 },
  { crs: 'NNG', name: 'Nottingham', lat: 52.9470, lon: -1.1469 },
  { crs: 'NMP', name: 'Northampton', lat: 52.2369, lon: -0.9024 },
  { crs: 'OXF', name: 'Oxford', lat: 51.7533, lon: -1.2700 },
  { crs: 'PAD', name: 'London Paddington', lat: 51.5154, lon: -0.1755 },
  { crs: 'PMH', name: 'Portsmouth Harbour', lat: 50.7973, lon: -1.1098 },
  { crs: 'PMS', name: 'Portsmouth & Southsea', lat: 50.7989, lon: -1.0916 },
  { crs: 'PBO', name: 'Peterborough', lat: 52.5749, lon: -0.2500 },
  { crs: 'PLY', name: 'Plymouth', lat: 50.3718, lon: -4.1430 },
  { crs: 'PRE', name: 'Preston', lat: 53.7564, lon: -2.7089 },
  { crs: 'PUT', name: 'Putney', lat: 51.4613, lon: -0.2088 },
  { crs: 'QRP', name: 'Queens Road Peckham', lat: 51.4740, lon: -0.0572 },
  { crs: 'RDG', name: 'Reading', lat: 51.4589, lon: -0.9717 },
  { crs: 'RDH', name: 'Redhill', lat: 51.2403, lon: -0.1654 },
  { crs: 'RMF', name: 'Romford', lat: 51.5753, lon: 0.1832 },
  { crs: 'RUG', name: 'Rugby', lat: 52.3788, lon: -1.2499 },
  { crs: 'SAL', name: 'Salisbury', lat: 51.0706, lon: -1.8019 },
  { crs: 'SDN', name: 'Sandown', lat: 50.6545, lon: -1.1545 },
  { crs: 'SVG', name: 'Stevenage', lat: 51.9025, lon: -0.2069 },
  { crs: 'SHP', name: 'Shepperton', lat: 51.3930, lon: -0.4452 },
  { crs: 'SHF', name: 'Sheffield', lat: 53.3782, lon: -1.4624 },
  { crs: 'SOT', name: 'Southampton Central', lat: 50.9071, lon: -1.4135 },
  { crs: 'SOA', name: 'Southampton Airport Parkway', lat: 50.9506, lon: -1.3641 },
  { crs: 'SOU', name: 'Southend Central', lat: 51.5370, lon: 0.7110 },
  { crs: 'SOC', name: 'Southend Victoria', lat: 51.5416, lon: 0.7111 },
  { crs: 'SPB', name: 'Staplehurst', lat: 51.1703, lon: 0.5535 },
  { crs: 'SBE', name: 'Streatham', lat: 51.4325, lon: -0.1282 },
  { crs: 'SRA', name: 'Stratford (London)', lat: 51.5416, lon: -0.0036 },
  { crs: 'STP', name: 'Stratford-upon-Avon', lat: 52.1917, lon: -1.7076 },
  { crs: 'SUR', name: 'Surbiton', lat: 51.3925, lon: -0.3040 },
  { crs: 'SWI', name: 'Swindon', lat: 51.5653, lon: -1.7854 },
  { crs: 'SWG', name: 'Stowmarket', lat: 52.1893, lon: 1.0000 },
  { crs: 'TAU', name: 'Taunton', lat: 51.0243, lon: -3.1023 },
  { crs: 'TBD', name: 'Tunbridge Wells', lat: 51.1313, lon: 0.2631 },
  { crs: 'THA', name: 'Thanet Parkway', lat: 51.3350, lon: 1.3500 },
  { crs: 'TON', name: 'Tonbridge', lat: 51.1929, lon: 0.2720 },
  { crs: 'TOT', name: 'Tottenham Hale', lat: 51.5882, lon: -0.0602 },
  { crs: 'TWI', name: 'Twickenham', lat: 51.4502, lon: -0.3296 },
  { crs: 'VIC', name: 'London Victoria', lat: 51.4952, lon: -0.1439 },
  { crs: 'WAT', name: 'London Waterloo', lat: 51.5032, lon: -0.1132 },
  { crs: 'WIM', name: 'Wimbledon', lat: 51.4215, lon: -0.2066 },
  { crs: 'WNC', name: 'Winchester', lat: 51.0672, lon: -1.3200 },
  { crs: 'WDN', name: 'Windsor & Eton Riverside', lat: 51.4830, lon: -0.6053 },
  { crs: 'WOK', name: 'Woking', lat: 51.3186, lon: -0.5571 },
  { crs: 'WVH', name: 'Wolverhampton', lat: 52.5883, lon: -2.1193 },
  { crs: 'WKG', name: 'Working', lat: 51.3186, lon: -0.5571 },
  { crs: 'WAE', name: 'London Waterloo East', lat: 51.5044, lon: -0.1085 },
  { crs: 'CHX', name: 'London Charing Cross', lat: 51.5074, lon: -0.1244 },
  { crs: 'CST', name: 'London Cannon Street', lat: 51.5113, lon: -0.0907 },
  { crs: 'BFR', name: 'London Blackfriars', lat: 51.5118, lon: -0.1035 },
  { crs: 'MOG', name: 'Moorgate', lat: 51.5186, lon: -0.0886 },
  { crs: 'ORP', name: 'Orpington', lat: 51.3745, lon: 0.0988 },
  { crs: 'SEV', name: 'Sevenoaks', lat: 51.2783, lon: 0.1900 },
  { crs: 'SNO', name: 'St Neots', lat: 52.2273, lon: -0.2713 },
  { crs: 'SAJ', name: 'St Albans City', lat: 51.7503, lon: -0.3270 },
  { crs: 'WFJ', name: 'Watford Junction', lat: 51.6636, lon: -0.3964 },
  { crs: 'HNH', name: 'Herne Hill', lat: 51.4550, lon: -0.0951 },
  { crs: 'TUH', name: 'Tulse Hill', lat: 51.4400, lon: -0.1048 },
  { crs: 'LWS', name: 'Lewisham', lat: 51.4658, lon: -0.0140 },
  { crs: 'GNW', name: 'Greenwich', lat: 51.4781, lon: -0.0131 },
  { crs: 'WLT', name: 'Walton-on-Thames', lat: 51.3721, lon: -0.4183 },
  { crs: 'HYM', name: 'Haymarket', lat: 55.9458, lon: -3.1818 },
  { crs: 'YRK', name: 'York', lat: 53.9581, lon: -1.0931 },
  { crs: 'SWA', name: 'Swansea', lat: 51.6253, lon: -3.9417 },
  { crs: 'CNW', name: 'Carnforth', lat: 54.1281, lon: -2.7732 },
  { crs: 'PNZ', name: 'Penzance', lat: 50.1221, lon: -5.5320 },
  { crs: 'SSD', name: 'Stansted Airport', lat: 51.8899, lon: 0.2583 },
  { crs: 'SDE', name: 'Southend East', lat: 51.5398, lon: 0.7236 },
  { crs: 'ZFD', name: 'Farringdon', lat: 51.5203, lon: -0.1049 },
  { crs: 'SPL', name: 'Seven Sisters', lat: 51.5824, lon: -0.0749 },
  { crs: 'CAN', name: 'Canterbury East', lat: 51.2760, lon: 1.0764 },
  { crs: 'CBW', name: 'Canterbury West', lat: 51.2843, lon: 1.0717 },
  { crs: 'WBC', name: 'Welwyn Garden City', lat: 51.8009, lon: -0.2067 },
  { crs: 'POT', name: 'Potters Bar', lat: 51.6975, lon: -0.1835 },
  { crs: 'ALX', name: 'Alexandra Palace', lat: 51.5981, lon: -0.1214 },
  { crs: 'HGY', name: 'Hornsey', lat: 51.5867, lon: -0.1183 },
  { crs: 'NBY', name: 'Northallerton', lat: 54.3360, lon: -1.4432 },
  { crs: 'DHM', name: 'Durham', lat: 54.7797, lon: -1.5815 },
  { crs: 'BER', name: 'Berwick-upon-Tweed', lat: 55.7589, lon: -2.0109 },
  { crs: 'ALM', name: 'Alnmouth', lat: 55.3923, lon: -1.6336 },
  { crs: 'STA', name: 'Stafford', lat: 52.8050, lon: -2.1204 },
  { crs: 'NUN', name: 'Nuneaton', lat: 52.5275, lon: -1.4647 },
  { crs: 'TBY', name: 'Tenby', lat: 51.6700, lon: -4.7062 },
  { crs: 'LMS', name: 'Lymington Pier', lat: 50.7569, lon: -1.5250 },
  { crs: 'BMH', name: 'Bournemouth', lat: 50.7272, lon: -1.8640 },
  { crs: 'POO', name: 'Poole', lat: 50.7190, lon: -1.9816 },
  { crs: 'WEY', name: 'Weymouth', lat: 50.6160, lon: -2.4541 },
  { crs: 'GCR', name: 'Gloucester', lat: 51.8601, lon: -2.2386 },
  { crs: 'WOS', name: 'Worcester Shrub Hill', lat: 52.1942, lon: -2.2148 },
  { crs: 'WOF', name: 'Worcester Foregate Street', lat: 52.1962, lon: -2.2247 },
  { crs: 'HFD', name: 'Hereford', lat: 52.0612, lon: -2.7084 },
  { crs: 'SHR', name: 'Shrewsbury', lat: 52.7124, lon: -2.7496 },
  { crs: 'CNM', name: 'Chesham', lat: 51.7050, lon: -0.6114 },
  { crs: 'CFN', name: 'Chalfont & Latimer', lat: 51.6681, lon: -0.5606 },
  { crs: 'RIC', name: 'Richmond', lat: 51.4632, lon: -0.3013 },
  { crs: 'KWB', name: 'Kew Bridge', lat: 51.4890, lon: -0.2878 },
  { crs: 'ISL', name: 'Isleworth', lat: 51.4745, lon: -0.3373 },
  { crs: 'HOU', name: 'Hounslow', lat: 51.4621, lon: -0.3622 },
  { crs: 'STN', name: 'Staines', lat: 51.4324, lon: -0.5085 },
  { crs: 'EGH', name: 'Egham', lat: 51.4310, lon: -0.5446 },
  { crs: 'VIR', name: 'Virginia Water', lat: 51.4019, lon: -0.5621 },
  { crs: 'ASC', name: 'Ascot', lat: 51.4063, lon: -0.6781 },
  { crs: 'SNF', name: 'Sandhurst', lat: 51.3435, lon: -0.8019 },
  { crs: 'CWU', name: 'Crowborough', lat: 51.0583, lon: 0.1633 },
  { crs: 'UCK', name: 'Uckfield', lat: 50.9696, lon: 0.0964 },
  { crs: 'LFD', name: 'Lingfield', lat: 51.1768, lon: -0.0129 },
  { crs: 'OXT', name: 'Oxted', lat: 51.2576, lon: -0.0051 },
  { crs: 'WDO', name: 'West Dulwich', lat: 51.4405, lon: -0.0902 },
  { crs: 'SYD', name: 'Sydenham', lat: 51.4279, lon: -0.0535 },
  { crs: 'NWD', name: 'Norwood Junction', lat: 51.3973, lon: -0.0748 },
  { crs: 'TTH', name: 'Tooting', lat: 51.4193, lon: -0.1609 },
  { crs: 'BAL', name: 'Balham', lat: 51.4431, lon: -0.1525 },
  { crs: 'STE', name: 'Streatham Hill', lat: 51.4385, lon: -0.1272 },
  { crs: 'WSW', name: 'Wandsworth Common', lat: 51.4462, lon: -0.1649 },
  { crs: 'QBR', name: 'Queenborough', lat: 51.4161, lon: 0.7586 },
  { crs: 'TAM', name: 'Tamworth', lat: 52.6404, lon: -1.6869 },
  { crs: 'LIC', name: 'Lichfield Trent Valley', lat: 52.6931, lon: -1.8082 },
  { crs: 'WGN', name: 'Wigan North Western', lat: 53.5442, lon: -2.6323 },
  { crs: 'WBQ', name: 'Warrington Bank Quay', lat: 53.3879, lon: -2.5963 },
  { crs: 'CNS', name: 'Carlisle', lat: 54.8904, lon: -2.9346 },
  { crs: 'OKL', name: 'Oakleigh Park', lat: 51.6183, lon: -0.1657 },
  { crs: 'NBP', name: 'New Barnet', lat: 51.6488, lon: -0.1711 },
  { crs: 'BNT', name: 'Barnet', lat: 51.6457, lon: -0.1967 },
  { crs: 'HDP', name: 'Hadley Wood', lat: 51.6676, lon: -0.1755 },
  { crs: 'GOR', name: 'Gordon Hill', lat: 51.6672, lon: -0.0927 },
  { crs: 'ENF', name: 'Enfield Chase', lat: 51.6532, lon: -0.0905 },
  { crs: 'GDP', name: 'Grange Park', lat: 51.6415, lon: -0.0964 },
  { crs: 'WNS', name: 'Winchmore Hill', lat: 51.6345, lon: -0.1003 },
  { crs: 'PAL', name: 'Palmers Green', lat: 51.6183, lon: -0.1100 },
  { crs: 'BOG', name: 'Bowes Park', lat: 51.6073, lon: -0.1200 },
  { crs: 'SKW', name: 'Southend Airport', lat: 51.5571, lon: 0.6968 },
  { crs: 'LEN', name: 'Letchworth Garden City', lat: 51.9799, lon: -0.2286 },
  { crs: 'BIW', name: 'Biggleswade', lat: 52.0841, lon: -0.2608 },
  { crs: 'SDY', name: 'Sandy', lat: 52.1299, lon: -0.2878 },
  { crs: 'HUN', name: 'Huntingdon', lat: 52.3282, lon: -0.1882 },
  { crs: 'ELY', name: 'Ely', lat: 52.3909, lon: 0.2668 },
  { crs: 'DNM', name: 'Downham Market', lat: 52.6077, lon: 0.3813 },
  { crs: 'KLN', name: 'Kings Lynn', lat: 52.7542, lon: 0.4046 },
  { crs: 'RYS', name: 'Royston', lat: 52.0480, lon: -0.0232 },
  { crs: 'AUD', name: 'Audley End', lat: 52.0057, lon: 0.2089 },
  { crs: 'BIS', name: 'Bishops Stortford', lat: 51.8702, lon: 0.1600 },
  { crs: 'HWN', name: 'Harlow Town', lat: 51.7800, lon: 0.0880 },
  { crs: 'TOM', name: 'Tottenham Hale', lat: 51.5882, lon: -0.0602 },
];

// Build CRS → Station map
const stationsByCrs = new Map<string, Station>();
for (const s of stationsArray) {
  stationsByCrs.set(s.crs, s);
}

// Build name index for search (lowercase name → Station[])
const stationsByNameLower: { lower: string; station: Station }[] = stationsArray.map(
  (s) => ({ lower: s.name.toLowerCase(), station: s })
);

export function getStationByCrs(crs: string): Station | undefined {
  return stationsByCrs.get(crs.toUpperCase());
}

export function searchStations(query: string, limit = 10): Station[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const crsMatch = stationsByCrs.get(q.toUpperCase());
  const results: Station[] = crsMatch ? [crsMatch] : [];
  const seen = new Set(results.map((s) => s.crs));

  // Name prefix matches first
  for (const { lower, station } of stationsByNameLower) {
    if (seen.has(station.crs)) continue;
    if (lower.startsWith(q)) {
      results.push(station);
      seen.add(station.crs);
      if (results.length >= limit) return results;
    }
  }

  // Then substring matches
  for (const { lower, station } of stationsByNameLower) {
    if (seen.has(station.crs)) continue;
    if (lower.includes(q)) {
      results.push(station);
      seen.add(station.crs);
      if (results.length >= limit) return results;
    }
  }

  // CRS prefix matches
  for (const { station } of stationsByNameLower) {
    if (seen.has(station.crs)) continue;
    if (station.crs.toLowerCase().startsWith(q)) {
      results.push(station);
      seen.add(station.crs);
      if (results.length >= limit) return results;
    }
  }

  return results;
}

export function isValidCrs(crs: string): boolean {
  return stationsByCrs.has(crs.toUpperCase());
}

export const TFL_LINE_IDS = [
  'bakerloo',
  'central',
  'circle',
  'district',
  'elizabeth',
  'hammersmith-city',
  'jubilee',
  'metropolitan',
  'northern',
  'piccadilly',
  'victoria',
  'waterloo-city',
  'dlr',
  'london-overground',
  'tram',
] as const;

export type TflLineId = (typeof TFL_LINE_IDS)[number];

export function isValidTflLine(lineId: string): boolean {
  return (TFL_LINE_IDS as readonly string[]).includes(lineId);
}
