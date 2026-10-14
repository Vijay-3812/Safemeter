/// Minimal geohash encoder compatible with `geofire-common` (used by the backend
/// to geo-query volunteers). Default precision 10 matches geofire's default.
class Geohash {
  static const _base32 = '0123456789bcdefghjkmnpqrstuvwxyz';

  static String encode(double lat, double lon, {int precision = 10}) {
    var latRange = [-90.0, 90.0];
    var lonRange = [-180.0, 180.0];
    final buf = StringBuffer();
    var even = true;
    var bit = 0;
    var ch = 0;

    while (buf.length < precision) {
      if (even) {
        final mid = (lonRange[0] + lonRange[1]) / 2;
        if (lon > mid) {
          ch |= 1 << (4 - bit);
          lonRange[0] = mid;
        } else {
          lonRange[1] = mid;
        }
      } else {
        final mid = (latRange[0] + latRange[1]) / 2;
        if (lat > mid) {
          ch |= 1 << (4 - bit);
          latRange[0] = mid;
        } else {
          latRange[1] = mid;
        }
      }
      even = !even;
      if (bit < 4) {
        bit++;
      } else {
        buf.write(_base32[ch]);
        bit = 0;
        ch = 0;
      }
    }
    return buf.toString();
  }
}
