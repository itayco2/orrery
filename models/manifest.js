// Orrery's exhibits, newest first.
window.ORRERY_MODELS = [
 {
  "slug": "neural-net",
  "title": "How does a machine learn from examples?",
  "question": "Nobody writes the rules into a neural network. So where do they come from?",
  "field": "Computing",
  "summary": "Set one artificial neuron by hand, walk gradient descent downhill (and break it with too big a step), then watch a tiny network trained live in your browser bend its boundary around XOR, a circle or two moons.",
  "built": "2026-10-01",
  "url": "models/neural-net/index.html",
  "thumbnail": "models/neural-net/thumb.png"
 },
 {
  "slug": "birthday",
  "title": "Why do two people in 23 probably share a birthday?",
  "question": "In a room of 23 people, a shared birthday is more likely than not. Why do so many people guess far lower?",
  "field": "Mathematics",
  "summary": "Fill rooms with random birthdays, count the pairs, and follow the same arithmetic to why a 128-bit hash gives only about 64 bits of protection against collisions.",
  "built": "2026-10-01",
  "url": "models/birthday/index.html",
  "thumbnail": "models/birthday/thumb.png"
 },
 {
  "slug": "simpson",
  "title": "Better in every group, worse overall?",
  "question": "How can a treatment win for small kidney stones and for large ones, yet lose overall?",
  "field": "Reasoning",
  "summary": "Simpson's paradox: make it happen with your own numbers, see it in real kidney-stone data, and understand it as unequal weights — then decide which number to trust.",
  "built": "2026-10-01",
  "url": "models/simpson/index.html",
  "thumbnail": "models/simpson/thumb.png"
 },
 {
  "slug": "selection",
  "title": "Does a better gene always win?",
  "question": "A new mutation that helps its carriers should spread. Why do most of them vanish?",
  "field": "Life",
  "summary": "Run a thousand populations and watch chance (genetic drift) erase most beneficial mutations: a 1% advantage wins only about 2% of the time, and in small populations even harmful variants can take over.",
  "built": "2026-10-01",
  "url": "models/selection/index.html",
  "thumbnail": "models/selection/thumb.png"
 },
 {
  "slug": "error-correction",
  "title": "How does a scratched CD still play?",
  "question": "A scratch wipes out thousands of bits at once. Why doesn't the music stop?",
  "field": "Computing",
  "summary": "Flip bits in Hamming's three-circle code and watch the failed checks point at the culprit, then drag a scratch across a stored picture and see how shuffling the bits lets every error be fixed.",
  "built": "2026-10-01",
  "url": "models/error-correction/index.html",
  "thumbnail": "models/error-correction/thumb.png"
 },
 {
  "slug": "tides",
  "title": "Why are there two tides a day?",
  "question": "The Moon pulls the sea towards it — so why is there a high tide on the far side too?",
  "field": "Astronomy",
  "summary": "The tide is the difference in the Moon’s pull across the Earth: a stretch both ways along the Earth–Moon line that fades as 1/d³. Turn the Earth under its two bulges, and add the Sun to get spring and neap tides.",
  "built": "2026-10-01",
  "url": "models/tides/index.html",
  "thumbnail": "models/tides/thumb.png"
 },
 {
  "slug": "orbits",
  "title": "Why doesn’t the Moon fall down?",
  "question": "It does fall, all the time. It just keeps missing the Earth.",
  "field": "Physics",
  "summary": "Fire Newton’s cannon faster and faster until the ball orbits or escapes, launch a planet onto a Kepler ellipse, check Kepler’s third law against the real planets, and change the law of gravity to see why only the inverse square closes the orbit.",
  "built": "2026-10-01",
  "url": "models/orbits/index.html",
  "thumbnail": "models/orbits/thumb.png"
 },
 {
  "slug": "sky-colour",
  "title": "Why is the sky blue and the sunset red?",
  "question": "Air is transparent and sunlight is white. So where do the blue sky and the red sunset come from?",
  "field": "Physics",
  "summary": "Air molecules scatter blue light about six times more strongly than red. Send light through a box of air, lower the Sun to the horizon through up to 38 atmospheres, and see why the sky isn't violet and clouds are white.",
  "built": "2026-10-01",
  "url": "models/sky-colour/index.html",
  "thumbnail": "models/sky-colour/thumb.png"
 },
 {
  "slug": "key-exchange",
  "title": "How can two strangers agree on a secret in public?",
  "question": "Two machines that have never met agree on a secret while anyone can listen. How?",
  "field": "Computing",
  "summary": "Diffie–Hellman key exchange, first with paint and then with arithmetic on a clock: perform the exchange with small numbers, watch an eavesdropper search, and see why each extra bit doubles her work.",
  "built": "2026-10-01",
  "url": "models/key-exchange/index.html",
  "thumbnail": "models/key-exchange/thumb.png"
 },
 {
  "slug": "traffic",
  "title": "Where do traffic jams come from when nothing’s wrong?",
  "question": "No crash, no roadworks, no merge — and still you crawl. How do drivers make a jam out of nothing, and why does it travel backwards?",
  "field": "Society",
  "summary": "A ring road of simulated drivers (the Nagel–Schreckenberg model) grows phantom jams from tiny hesitations. Watch them drift upstream at motorway-like speeds, and find the density above which more cars carry less traffic.",
  "built": "2026-10-01",
  "url": "models/traffic/index.html",
  "thumbnail": "models/traffic/thumb.png"
 },
 {
  "slug": "galton",
  "title": "Why do bell curves show up everywhere?",
  "question": "Heights, errors and test scores all make the same hump. Why — and when don't they?",
  "field": "Mathematics",
  "summary": "A Galton board, sums of dice of any shape, and growth that multiplies: the central limit theorem, and the two ways the bell curve fails.",
  "built": "2026-10-01",
  "url": "models/galton/index.html",
  "thumbnail": "models/galton/thumb.png"
 },
 {
  "slug": "moon-phases",
  "title": "Why does the Moon have phases?",
  "question": "It isn't Earth's shadow. Drag the Moon round its orbit and see what is really going on.",
  "field": "Astronomy",
  "summary": "Half the Moon is always lit; the phase is how much of that half faces us. Test the shadow explanation, see why eclipses come in seasons (with a real ephemeris that finds 2026's four eclipses), and why we always see the same face.",
  "built": "2026-10-01",
  "url": "models/moon-phases/index.html",
  "thumbnail": "models/moon-phases/thumb.png"
 },
 {
  "slug": "rainbow",
  "title": "Why is a rainbow round?",
  "question": "You can never walk to a rainbow, and the person beside you sees a different one. What is it, and why is it always part of a circle?",
  "field": "Physics",
  "summary": "Trace sunlight through a raindrop: the exit angles pile up at about 42° from the shadow of your head, so the drops that flash at you lie on a cone around your eye. Water bends violet more than red, which spreads the colours, and the Sun's height decides how much of the circle is above the ground.",
  "built": "2026-10-01",
  "url": "models/rainbow/index.html",
  "thumbnail": "models/rainbow/thumb.png"
 },
 {
  "slug": "epicycles",
  "title": "Can circles draw anything?",
  "question": "Why does Mars sometimes go backwards — and can circles on circles trace any shape?",
  "field": "Mathematics",
  "summary": "Arrows spinning on arrows: Ptolemy's epicycles reproduce Mars's backward loops, and with enough of them — a Fourier series — they redraw any closed shape, including one you draw.",
  "built": "2026-09-30",
  "url": "models/epicycles/index.html",
  "thumbnail": "models/epicycles/thumb.png"
 },
 {
  "slug": "herd-immunity",
  "title": "How many people need to be immune?",
  "question": "Why does measles need about 95% vaccinated, when other infections need far less?",
  "field": "Life",
  "summary": "Chains of infection, an SIR epidemic, overshoot and vaccine coverage, all from one idea: an outbreak grows only while each case causes more than one new case. The threshold is 1 − 1/R0.",
  "built": "2026-09-30",
  "url": "models/herd-immunity/index.html",
  "thumbnail": "models/herd-immunity/thumb.png"
 },
 {
  "slug": "orrery",
  "title": "Where are the planets tonight?",
  "question": "The planets are somewhere specific right now. Where, and why do they sometimes seem to run backwards?",
  "field": "Astronomy",
  "summary": "A working model of the solar system at today's date, from JPL's orbital elements: turn the crank to see where each planet is, watch Mars loop backwards as Earth overtakes it in 2027, and see why the outer planets are so slow.",
  "built": "2026-09-30",
  "url": "models/orrery/index.html",
  "thumbnail": "models/orrery/thumb.png"
 },
 {
  "slug": "chaos",
  "title": "Why can’t we forecast the weather a month ahead?",
  "question": "Two pendulums started a millionth of a radian apart soon do completely different things. Why doesn’t exact physics mean exact forecasts?",
  "field": "Physics",
  "summary": "A double pendulum obeys Newton’s laws with no randomness, yet tiny differences in its start grow exponentially, so each tenfold gain in precision buys only a fixed extra stretch of forecast. The atmosphere behaves the same way, which is why day-to-day forecasts are useful for about ten days today and can never reach much beyond two weeks.",
  "built": "2026-09-30",
  "url": "models/chaos/index.html",
  "thumbnail": "models/chaos/thumb.png"
 },
 {
  "slug": "seasons",
  "title": "Why is summer warm?",
  "question": "Earth is closest to the Sun in January. So why is July the warm month in the north?",
  "field": "Astronomy",
  "summary": "Drag Earth round its orbit drawn to scale, tilt a beam of sunlight, and watch the day and night line cross a tilted globe, then switch off the tilt or the orbit's stretch to see which one makes the seasons.",
  "built": "2026-09-30",
  "url": "models/seasons/index.html",
  "thumbnail": "models/seasons/thumb.png"
 },
 {
  "slug": "queues",
  "title": "Why is the other line always faster?",
  "question": "A checkout busy 80% of the time already has a queue. Why do waits explode near full capacity — and why is your line so rarely the fast one?",
  "field": "Society",
  "summary": "Simulated checkouts show how randomness alone creates queues, why the wait explodes as a till nears 100% busy, why one shared line beats three separate ones, and why variability matters as much as the average.",
  "built": "2026-09-30",
  "url": "models/queues/index.html",
  "thumbnail": "models/queues/thumb.png"
 },
 {
  "slug": "positive-test",
  "title": "You tested positive. Now what?",
  "question": "A 99%-accurate test says you have a rare disease. Why is the chance you're sick only about 9%?",
  "field": "Reasoning",
  "summary": "Count the people in a town of 10,000 to see why most positive results for a rare disease are false alarms, how who gets tested changes the answer, and what a second test does — Bayes' rule in odds form.",
  "built": "2026-09-30",
  "url": "models/positive-test/index.html",
  "thumbnail": "models/positive-test/thumb.png"
 }
];
