## Data bugs (found by tests)

- [ ] `assets/points/photos.geojson` feature index 748 is a completely blank record:
      all properties (`filename`, `description`, `priority`, `timestamp`) are `null`
      and `geometry` is `null`. Should be deleted from the file.
      _Detected by `tests/geojson-schema.test.js` null geometry audit._

---

MoSCoW

** Must have **
- [x] Add basic animation ordering in 4 parts
- [x] Update function to return a promise that resolves when the animation is done, which
can be used to trigger the next animation
- [x] Make images markers appear at the end of the track animation
- [x] Some sort of clustering or jiggling of the markers so they don't overlap too much
- [x] Style the images to look like a polariod, with a white border and a shadow
- [x] Test for mobile devices and make sure it works well

S
- [x] Rewrite animation ordering based on speed so that it uses proper branching
- [x] Fix some of the image locations and or walking routes so they actually line up properly
- [x] Add in google maps icons in places
- [x] Make the images animate up from the bottom of the screen than just appear
- [x] Redefine mouseover effect on markers so they don't prevent interaction with other markers


- [x] Show a little plane flying into Tokyo first, that might be fun.
- [x] It would be nice if we could get the markers to animate in by jittering but I doubt I can get it to works

---
### New Features

- [ ] Plane lines, for various air travel between places (transparent if possible)
- [x] Carousel of best photos — pile of mini polaroids, bottom-left (centred on mobile).
      Membership from the `priority` field in photos.geojson. Tap the top card to fly the
      map there and open the blow-up.
- [ ] Can we get the moving lines to fade out as the main lines come in? 
- [ ] New base map (I can pay for watercolour) and like, more drawing like lines would be great rather than the strict data ones we have now
