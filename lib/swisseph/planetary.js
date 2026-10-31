
import sweph from "sweph";
import path from "node:path";

// Location of Swiss Ephemeris data files.
// Keep these files outside the public directory in production.
const EPHE_PATH = path.join(process.cwd(), "ephe");

let initialized = false;

function initializeSwissEphemeris() {
  if (initialized) return;

  sweph.set_ephe_path(EPHE_PATH);
  initialized = true;
}

const PLANETS = {
  Sun: sweph.constants.SE_SUN,
  Moon: sweph.constants.SE_MOON,
  Mercury: sweph.constants.SE_MERCURY,
  Venus: sweph.constants.SE_VENUS,
  Mars: sweph.constants.SE_MARS,
  Jupiter: sweph.constants.SE_JUPITER,
  Saturn: sweph.constants.SE_SATURN,
};

const normalize = (degree) =>
  ((degree % 360) + 360) % 360;

/**
 * Calculate planetary positions using Swiss Ephemeris.
 *
 * Input:
 *   year, month, day, hour, minute, second in UTC
 *
 * Output:
 *   Tropical longitude, latitude, distance and daily speed.
 */
export function calculateSwissPlanets({
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
}) {
  initializeSwissEphemeris();

  const date = sweph.utc_to_jd(
    year,
    month,
    day,
    hour,
    minute,
    second,
    sweph.constants.SE_GREG_CAL
  );

  if (date.flag !== sweph.constants.OK) {
    throw new Error(date.error || "Julian day conversion failed");
  }

  const [jdET, jdUT] = date.data;

  const flags =
    sweph.constants.SEFLG_SWIEPH |
    sweph.constants.SEFLG_SPEED;

  const planets = {};

  for (const [name, planetId] of Object.entries(PLANETS)) {
    const result = sweph.calc(jdET, planetId, flags);

    if (result.flag !== flags) {
      throw new Error(
        `${name}: ${result.error || "Swiss Ephemeris calculation failed"}`
      );
    }

    const [longitude, latitude, distance,
      longitudeSpeed, latitudeSpeed, distanceSpeed] = result.data;

    planets[name] = {
      tropicalLongitude: normalize(longitude),
      latitude,
      distance,
      longitudeSpeed,
      latitudeSpeed,
      distanceSpeed,
      retrograde: longitudeSpeed < 0,
    };
  }

  return {
    jdET,
    jdUT,
    planets,
  };
}
