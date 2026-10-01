# Third-party code and data in Orrery

This file lists what in this repository comes from elsewhere. It is a careful reading of the
files, prepared on 2026-10-01; it is not legal advice. Each exhibit also ends with its own list of
sources.

## 1. Third-party code

### In the site

**No vendored libraries, fonts or remote resources.** No page loads anything from outside; the
pages use the reader's own system fonts.

| What | Where | Origin | Licence |
|---|---|---|---|
| **mulberry32**, a few-line seeded random number generator, re-typed in JavaScript | the scripts of several simulation exhibits (for example `models/queues/queues-lib.js`, `herd-immunity/model.js`, `positive-test/exhibit.js`, `galton/`, `traffic/`, `selection/`, `error-correction/`) | Tommy Ettinger, 2017, [gist](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c) | Dedicated to the public domain under **CC0 1.0** (stated in the gist's header). The code comments name it. |

Its author noted in 2022 that mulberry32 is not equidistributed; for simulations drawn on screen
this does not matter.

### Not included

No build tools, test browsers or other third-party binaries are part of this repository: it holds
only the static site.

## 2. Data and facts the exhibits rely on

The exhibits contain **numbers and formulas** taken from published sources, each cited on the
exhibit's own page in a "Sources" list. Numbers, facts and formulas are generally not protected by
copyright (US law; the EU's database right protects substantial extracts of databases, which these
few values are not). No text, images or figures from these sources are copied. The table lists the
sources whose values are actually built into the models' code or tuned against; everything else on
the pages is cited for the explanation.

| Exhibit | Data in the model | Source | Terms |
|---|---|---|---|
| Where are the planets tonight? (`orrery/ephemeris.js`); the front-door emblem (`assets/home.js`) | Orbital elements and rates of the eight planets (Table 1, 1800–2050) | E. M. Standish, *Keplerian Elements for Approximate Positions of the Major Planets*, JPL Solar System Dynamics, [ssd.jpl.nasa.gov/planets/approx_pos.html](https://ssd.jpl.nasa.gov/planets/approx_pos.html) | Published numerical data, cited in the code and on the page. JPL's general policy for its content asks for the credit "Courtesy NASA/JPL-Caltech" and forbids implying endorsement ([JPL image use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/), read 2026-10-01). No NASA or JPL logos are used. |
| Why is summer warm? (`seasons/model.js`) | 2026 dates of perihelion, aphelion, equinoxes and solstices; Earth's eccentricity and tilt; solar constant 1,361 W/m² | US Naval Observatory, *Earth's Seasons and Apsides*; NASA *Earth Fact Sheet*; Kopp & Lean, GRL 38 (2011) | US government works (USNO, NASA) are public domain in the US; a single measured constant from a paper is a fact. Cited on the page. |
| Can circles draw anything? | Mars and Earth orbital periods, semi-major axis, eccentricity | NASA NSSDCA *Mars Fact Sheet* | US government work; cited. |
| How many people need to be immune? | Ranges of R₀ for measles and influenza; MMR effectiveness (93% / 97%) | Guerra et al., Lancet Infect Dis (2017); Biggerstaff et al., BMC Infect Dis (2014, open access CC BY); US CDC *About Measles* | Facts taken from papers and a US government page; cited. |
| You tested positive. Now what? | Survey results (60 respondents in 1978; 14 of 61 in 2014; Gigerenzer & Hoffrage's 16% / 46%) | NEJM (1978), JAMA Intern Med (2014), Psychological Review (1995) | Facts reported in the text; cited. |
| Why can't we forecast the weather a month ahead? | Lorenz's 1963 equations and parameters; double-pendulum equations of motion | Lorenz (1963); E. Neumann, myPhysicsLab | Equations, not code: the simulation was written here. Cited. |
| Why is the other line always faster? | Queueing formulas (M/M/1, Erlang C, Pollaczek–Khinchine, Kingman) | Harchol-Balter (2013), Kingman (1961), Kleinrock (1975), Wikipedia (cross-check) | Standard formulas; cited. |
| Why does the Moon have phases? (`moon-phases/sky.js`) | Truncated series for the Sun's and Moon's positions (largest terms only); Moon's orbital elements; 2026 eclipse list (used to check) | J. Meeus, *Astronomical Algorithms*, 2nd ed. (1998), ch. 25 and 47; NASA *Moon Fact Sheet*; F. Espenak, NASA Eclipse Web Site | Meeus's book is copyrighted, but what is used is a handful of numerical coefficients and the method, re-typed in JavaScript and cited in the code; algorithms and numbers are generally not protected. NASA pages are US government works. It is the one place where values come from a commercial book. |
| Why is a rainbow round? (`rainbow/`) | Sellmeier coefficients for the refractive index of water at 20 °C | Daimon & Masumura, Applied Optics 46 (2007), as tabulated by refractiveindex.info | The refractiveindex.info database is dedicated to the public domain under CC0 1.0 ([its repository's README](https://github.com/polyanskiy/refractiveindex.info-database), checked 2026-10-01). Nothing required. |
| How can two strangers agree on a secret in public? (`key-exchange/`) | The textbook worked example p = 23, g = 5 (key 18); facts about X25519 and ML-KEM | Diffie & Hellman (1976); RFC 7748; NIST FIPS 203 | Standard small example and facts; cited. No data tables. |

Exhibits published after this table was written (among them *orbits*, *selection*, *simpson*,
*sky-colour*, *tides*, *traffic*, *error-correction* and *galton*) cite their sources in the
"Sources" list at the end of each page. *Why do bell curves show up everywhere?* (`galton/`) also
uses an Abramowitz & Stegun numerical approximation; A&S was published by the US National Bureau
of Standards in 1964, a US government work.

The exhibit thumbnails (`models/*/thumb.png`) and the social preview (`social-preview.png`) are
pictures of Orrery's own pages, with no third-party images in them.

## 3. Orrery's own licence

- **Code** (HTML structure, CSS, JavaScript): MIT, see [LICENSE](LICENSE).
- **Text and figures** (the exhibits' words and pictures, thumbnails):
  CC BY-NC 4.0, see [LICENSE-CONTENT.md](LICENSE-CONTENT.md).
