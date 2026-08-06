/* global window */
(function (global) {
  "use strict";

  // Minimal SHA-256 (sync) for stable ids without crypto.subtle secure-context issues.
  // Adapted compact implementation.
  function rotr(n, x) {
    return (x >>> n) | (x << (32 - n));
  }

  function sha256(ascii) {
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var lengthProperty = "length";
    var i;
    var j;
    var result = "";
    var words = [];
    var asciiBitLength = ascii[lengthProperty] * 8;
    var hash = (sha256.h = sha256.h || []);
    var k = (sha256.k = sha256.k || []);
    var primeCounter = k[lengthProperty];
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate += 1) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        primeCounter += 1;
      }
    }
    ascii += "\x80";
    while ((ascii[lengthProperty] % 64) - 56) {
      ascii += "\x00";
    }
    for (i = 0; i < ascii[lengthProperty]; i += 1) {
      j = ascii.charCodeAt(i);
      if (j >> 8) {
        return "";
      }
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
    words[words[lengthProperty]] = asciiBitLength;
    for (j = 0; j < words[lengthProperty]; ) {
      var w = words.slice(j, (j += 16));
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i += 1) {
        var w15 = w[i - 15];
        var w2 = w[i - 2];
        var a = hash[0];
        var e = hash[4];
        var temp1 =
          hash[7] +
          (rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          (w[i] =
            i < 16
              ? w[i]
              : (w[i - 16] +
                  (rotr(7, w15) ^ rotr(18, w15) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rotr(17, w2) ^ rotr(19, w2) ^ (w2 >>> 10))) |
                0);
        var temp2 =
          (rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i += 1) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }
    for (i = 0; i < 8; i += 1) {
      for (j = 3; j + 1; j -= 1) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? "0" : "") + b.toString(16);
      }
    }
    return result;
  }

  function utf8Encode(str) {
    return unescape(encodeURIComponent(String(str)));
  }

  function hashHex(str) {
    return sha256(utf8Encode(str));
  }

  function makeMergedId(normalizedSource) {
    return "v1_" + hashHex(normalizedSource).slice(0, 16);
  }

  function contentHash(rawText) {
    return hashHex(String(rawText));
  }

  global.StringI18nHash = {
    hashHex: hashHex,
    makeMergedId: makeMergedId,
    contentHash: contentHash
  };
})(window);
