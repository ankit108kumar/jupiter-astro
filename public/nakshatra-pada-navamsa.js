/* JupiterAstro: Nakshatra Pada → Navamsa
 *
 * Derives Navamsa intervals for planets without direct
 * Navamsa timestamps in the correction database.
 *
 * Each Nakshatra's actual transit duration is divided
 * into four equal time intervals.
 */
(function (root) {
  'use strict';

  const NAKSHATRAS = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini',
    'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya',
    'Ashlesha', 'Magha', 'Purva Phalguni',
    'Uttara Phalguni', 'Hasta', 'Chitra',
    'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha',
    'Shravana', 'Dhanishtha', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada',
    'Revati'
  ];

  const SIGNS = [
    'Aries', 'Taurus', 'Gemini', 'Cancer',
    'Leo', 'Virgo', 'Libra', 'Scorpio',
    'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
  ];

  const NAK_INDEX = Object.create(null);

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
  }

  NAKSHATRAS.forEach((name, index) => {
    NAK_INDEX[normalize(name)] = index;
  });

  // Timestamps without an explicit UTC offset are interpreted
  // in Asia/Kolkata, matching the correction database.
  function toTimestamp(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;

    let input = String(value || '').trim();
    if (!/(Z|[+-]\d{2}:\d{2})$/i.test(input)) {
      input += '+05:30';
    }

    return Date.parse(input);
  }

  function buildIntervals(nakshatra, start, end) {
    const index = NAK_INDEX[normalize(nakshatra)];
    const startMs = toTimestamp(start);
    const endMs = toTimestamp(end);

    if (index === undefined) {
      throw new Error('Unknown Nakshatra: ' + nakshatra);
    }

    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      endMs <= startMs
    ) {
      throw new Error('Invalid Nakshatra interval.');
    }

    const duration = endMs - startMs;

    return [1, 2, 3, 4].map(pada => {
      const navamsaIndex = (index * 4 + pada - 1) % 12;
      const intervalStart =
        startMs + Math.round(duration * (pada - 1) / 4);
      const intervalEnd =
        startMs + Math.round(duration * pada / 4);

      return {
        nakshatra: NAKSHATRAS[index],
        pada,
        navamsa: SIGNS[navamsaIndex],
        navamsaNumber: navamsaIndex + 1,
        startMs: intervalStart,
        endMs: intervalEnd,
        entryMs: intervalStart
      };
    });
  }

  function resolveAt(nakshatra, start, end, timestamp) {
    const time = toTimestamp(timestamp);

    if (!Number.isFinite(time)) {
      throw new Error('Invalid evaluation timestamp.');
    }

    const intervals = buildIntervals(nakshatra, start, end);

    return intervals.find(interval =>
      time >= interval.startMs && time < interval.endMs
    ) || null;
  }

  root.JANakshatraPadaNavamsa = Object.freeze({
    buildIntervals,
    resolveAt,
    nakshatras: NAKSHATRAS.slice(),
    signs: SIGNS.slice()
  });
})(window);
