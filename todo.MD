MoSCoW

** Must have **
- [x] Add basic animation ordering in 4 parts
- [x] Update function to return a promise that resolves when the animation is done, which
can be used to trigger the next animation
- [x] Make images markers appear at the end of the track animation
- [x] Some sort of clustering or jiggling of the markers so they don't overlap too much
- [x] Style the images to look like a polariod, with a white border and a shadow
- [ ] Test for mobile devices and make sure it works well

S
- [x] Rewrite animation ordering based on speed so that it uses proper branching
- [ ] Add regional polygons to zoom into
- [ ] Fix some of the image locations and or walking routes so they actually line up properly
- [ ] Multiple levels of area zooming, so you can zoom into a region and then into a city
- [ ] Add in google maps icons in places
- [x] Make the images animate up from the bottom of the screen than just appear
- [ ] Redefine mouseover effect on markers so they don't prevent interaction with other markers

C
- [ ] Show animated marker for each region when zoomed into, which might involve rehighlting the line
- [ ] Show a little plane flying into Tokyo first, that might be fun.
- [ ] Switch between different tile layers
- [x] It would be nice if we could get the markers to animate in by jittering but I doubt I can get it to works