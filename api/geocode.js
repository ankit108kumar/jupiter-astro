
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = String(req.query.q || '').trim();

  if (query.length < 3 || query.length > 200) {
    return res.status(400).json({ error: 'Invalid place query' });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (!key) {
    return res.status(500).json({ error: 'Google API key not configured' });
  }

  try {
    const url = new URL(
      'https://maps.googleapis.com/maps/api/geocode/json'
    );

    url.searchParams.set('address', query);
    url.searchParams.set('key', key);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.status !== 'OK') {
      return res.status(502).json({
        error: 'Google Geocoding failed',
        status: data.status,
        message: data.error_message || ''
      });
    }

    const results = data.results.slice(0, 5).map(item => ({
      label: item.formatted_address,
      name: item.address_components?.[0]?.long_name ||
            item.formatted_address.split(',')[0],
      lat: item.geometry.location.lat,
      lon: item.geometry.location.lng,
      placeId: item.place_id
    }));

    return res.status(200).json(results);

  } catch (err) {
    console.error('Geocoding endpoint error:', err);
    return res.status(500).json({ error: 'Geocoding request failed' });
  }
};

