
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const timestamp = Number(req.query.timestamp);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    !Number.isFinite(timestamp) ||
    lat < -90 || lat > 90 ||
    lon < -180 || lon > 180
  ) {
    return res.status(400).json({ error: 'Invalid coordinates or timestamp' });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (!key) {
    return res.status(500).json({ error: 'Google API key not configured' });
  }

  try {
    const url = new URL(
      'https://maps.googleapis.com/maps/api/timezone/json'
    );

    url.searchParams.set('location', `${lat},${lon}`);
    url.searchParams.set('timestamp', String(Math.floor(timestamp)));
    url.searchParams.set('key', key);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.status !== 'OK') {
      return res.status(502).json({
        error: 'Google Time Zone lookup failed',
        status: data.status,
        message: data.errorMessage || ''
      });
    }

    return res.status(200).json({
      timeZoneId: data.timeZoneId,
      timeZoneName: data.timeZoneName,
      rawOffset: data.rawOffset,
      dstOffset: data.dstOffset,
      utcOffset: (data.rawOffset + data.dstOffset) / 3600
    });

  } catch (err) {
    console.error('Timezone endpoint error:', err);
    return res.status(500).json({ error: 'Timezone request failed' });
  }
};

