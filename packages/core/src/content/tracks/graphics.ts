/**
 * Track 38 — Computer Graphics.
 *
 * How a scene becomes pixels. Placed alongside the AI material deliberately:
 * the rendering pipeline is where GPUs came from, and the convolution and
 * sampling ideas here are the same ones the computer vision track uses.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, interactive, lesson, match, mcq, multi, order, shortAnswer, trueFalse } from '../builders';

export const graphicsTrack: Track = {
  id: 'track-graphics',
  title: 'Computer Graphics',
  tagline: 'Turning geometry into pixels',
  description:
    'Raster and vector, colour and gamma, transforms, rasterization, shading, ray tracing, textures and aliasing — the pipeline GPUs were built for, and the reason they later turned out to suit deep learning.',
  domain: 'graphics',
  level: 'intermediate',
  icon: '🎨',
  gradient: ['#F472B6', '#FBBF24'],
  prerequisites: ['track-math'],
  outcomes: [
    'Choose between raster and vector representations with reasons',
    'Explain gamma and why averaging pixels naively darkens an image',
    'Compose transforms and say why graphics uses 4×4 matrices for 3D',
    'Describe how a triangle becomes shaded pixels, stage by stage',
    'Compare rasterization and ray tracing honestly',
    'Recognise aliasing and name the fix for each kind',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-gfx-1',
      title: 'Images and Geometry',
      description: 'What a picture is made of, and how to move things around.',
      lessons: [
        lesson({
          id: 'lesson-raster-colour',
          title: 'Raster, Vector, and Colour',
          summary: 'Pixels or instructions, and why colour arithmetic is not obvious.',
          level: 'intro',
          domain: 'graphics',
          free: true,
          steps: [
            concept(
              'Two ways to describe a picture',
              '**Raster** is a grid of pixels. A photograph is raster because there is no shorter description of it. Fixed resolution: enlarge it and you are inventing detail.\n\n**Vector** is a set of drawing instructions — "a circle here, radius 40, filled blue". Resolution-independent, so it renders crisply at any size, and usually tiny. Suited to logos, icons, type and diagrams; hopeless for photographs.\n\nFonts are the most consequential vector format. A glyph is a set of curves, which is why text stays sharp at every size and why a font file is a program rather than a picture.\n\nFor raster, the two numbers that matter are **resolution** (how many pixels) and **bit depth** (how many values per channel). 8 bits per channel gives 256 levels each of red, green and blue, which is enough for most viewing and not enough for heavy editing — adjust the exposure of an 8-bit image hard and you get **banding**, visible steps where smooth gradient should be. This is quantisation error, exactly as in the architecture track, showing up as a visible artefact.\n\nWhich is why photographers shoot raw at 12 or 14 bits and export to 8: you want the headroom during editing and only need the final range at the end. The same reasoning as training in float32 and serving quantised.',
              {
                keyTerms: [
                  { term: 'Raster', definition: 'A fixed grid of pixels.' },
                  { term: 'Banding', definition: 'Visible steps in a gradient from insufficient bit depth.' },
                ],
              },
            ),
            categorize(
              'Raster or vector?',
              ['Raster', 'Vector'],
              [
                { item: 'A photograph', category: 'Raster' },
                { item: 'A company logo', category: 'Vector' },
                { item: 'A font glyph', category: 'Vector' },
                { item: 'A screenshot', category: 'Raster' },
                { item: 'A map’s road lines', category: 'Vector' },
              ],
              ['sk-raster-vector'],
              'Anything you want crisp at any size, and describable in shapes, wants to be vector.',
            ),
            concept(
              'Gamma, and why averaging pixels is wrong',
              'Here is a fact that surprises nearly everyone who learns it, and which silently degrades a great deal of image processing code.\n\nHuman vision is not linear in light. We are far more sensitive to differences among dark tones than among bright ones. So storing brightness linearly in 8 bits wastes most of the range on highlights we cannot distinguish and starves the shadows where we can.\n\nImage formats therefore store **gamma-encoded** values: roughly the physical intensity raised to the power 1/2.2. A pixel value of 128 is not half the light of 255 — it is about 22% of it.\n\nThe consequence is concrete. Averaging two gamma-encoded pixels does **not** give the average brightness. Blend pure red (255, 0, 0) and pure green (0, 255, 0) naively and you get a muddy dark yellow; blend them correctly — convert to linear, average, convert back — and you get a bright yellow. Photoshop and most renderers have quietly had a "blend in linear space" option for decades because of this.\n\nThe rule: **do arithmetic in linear space, store and display in gamma space.** Resizing, blurring, blending, compositing and lighting are all arithmetic, and all wrong if done on gamma-encoded values.\n\nAnd this reaches machine learning directly. A CNN trained on gamma-encoded JPEGs is learning from values that are non-linear in physical light, which is usually fine because it is consistent — and occasionally matters a great deal, in anything doing physically-based estimation.',
              {
                keyTerms: [
                  { term: 'Gamma encoding', definition: 'Storing intensity non-linearly to match human perceptual sensitivity.' },
                  { term: 'Linear space', definition: 'Values proportional to physical light — where arithmetic is valid.' },
                ],
              },
            ),
            mcq(
              'Why does naively averaging two pixel values give the wrong brightness?',
              [
                'Rounding error',
                'Stored values are gamma-encoded, so they are not proportional to physical light',
                'The colour space is too small',
                '8 bits is insufficient',
              ],
              1,
              ['sk-colour-spaces'],
              'Convert to linear, do the arithmetic, convert back. Half the "why does my resized image look wrong" questions are this.',
            ),
            trueFalse(
              'A pixel value of 128 represents about half the light of a value of 255.',
              false,
              ['sk-colour-spaces'],
              'Roughly 22%, because of the gamma curve. The encoding devotes more of the range to dark tones, where we can see the differences.',
            ),
            concept(
              'Transforms, and the fourth coordinate',
              'Moving, rotating and scaling objects is **linear algebra** — the matrices from the maths track, doing their original job.\n\nA 2×2 matrix can rotate and scale a 2D point. It cannot **translate** one, because a linear transformation always fixes the origin.\n\nThe fix is elegant: add a coordinate. Represent the 2D point (x, y) as (x, y, 1) and use a 3×3 matrix. Translation becomes a shear in the third dimension, which is linear. These are **homogeneous coordinates**, and it is why 3D graphics uses 4×4 matrices for 3-dimensional space.\n\nThe payoff is that every transform is now one uniform type of object, so a chain of them **composes by multiplication**:\n\n```\nM = Projection · View · Model\n```\n\nOne matrix multiply per vertex applies the object’s placement, the camera, and the perspective projection together. This is exactly the kind of work a GPU does — thousands of independent identical matrix-vector products — which is the historical reason GPUs are wide arithmetic engines, and therefore the reason they later suited deep learning.\n\nTwo things to remember: matrix multiplication is **not commutative**, so rotate-then-translate differs from translate-then-rotate, and getting the order wrong is the most common bug in graphics code. And the fourth coordinate does real work in perspective: dividing by w after projection is what makes distant things smaller.',
              {
                keyTerms: [
                  { term: 'Homogeneous coordinates', definition: 'An extra coordinate making translation expressible as a matrix.' },
                  { term: 'Composition', definition: 'Chained transforms combine into one matrix by multiplication.' },
                ],
              },
            ),
            mcq(
              'Why does 3D graphics use 4×4 matrices for 3D points?',
              [
                'For colour',
                'The extra homogeneous coordinate lets translation and perspective be expressed as matrix operations',
                'For time',
                'For transparency',
              ],
              1,
              ['sk-transforms'],
              'Translation is not linear in 3D, and becomes linear in 4D. The division by w afterwards is what produces perspective.',
            ),
            trueFalse(
              'Rotating then translating gives the same result as translating then rotating.',
              false,
              ['sk-transforms'],
              'Matrix multiplication does not commute, and this is the most common source of bugs in transform code.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-gfx-1',
        title: 'Images and Geometry Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Which format is resolution-independent?',
            ['PNG', 'JPEG', 'SVG', 'BMP'],
            2,
            ['sk-raster-vector'],
            'Vector instructions render crisply at any size.',
          ),
          mcq(
            'Where should you do image arithmetic?',
            ['In gamma space', 'In linear space, converting back afterwards', 'In 8 bits', 'It does not matter'],
            1,
            ['sk-colour-spaces'],
            'Gamma-encoded values are not proportional to light, so averaging them is not averaging brightness.',
          ),
          trueFalse(
            'Homogeneous coordinates exist so translation can be a matrix operation.',
            true,
            ['sk-transforms'],
            'And so perspective division falls out of the same representation.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-gfx-2',
      title: 'Making Pixels',
      description: 'Rasterization, shading, ray tracing, and the artefacts of sampling.',
      lessons: [
        lesson({
          id: 'lesson-rasterization',
          title: 'Rasterization and Shading',
          summary: 'Triangles to pixels, and deciding what colour each one is.',
          level: 'intermediate',
          domain: 'graphics',
          steps: [
            concept(
              'Why everything is triangles',
              'Real-time graphics represents every surface as a mesh of **triangles**, for reasons that are all practical.\n\nA triangle is always **planar** — three points define a plane, so there is no ambiguity about what surface you mean. It is always **convex**, which makes the "is this pixel inside" test trivial. It is the simplest polygon, so any other shape can be decomposed into them. And interpolating a value across one has a clean, unique definition through barycentric coordinates.\n\n**Rasterization** then converts each triangle to pixels:\n\n1. Transform its vertices into screen space using the matrix chain.\n2. Find the pixels whose centres fall inside.\n3. Interpolate the vertex attributes — colour, normal, texture coordinate, depth — across those pixels.\n4. Run a shader per pixel to compute the final colour.\n5. Compare against the **depth buffer** and keep the nearest.\n\nThe depth buffer deserves a mention because it solves a hard problem cheaply. Sorting triangles by distance fails on intersecting or mutually overlapping geometry; storing the nearest depth so far per pixel and rejecting anything further away handles every case, and costs one comparison. It was a genuinely important idea.\n\nThe critical property of rasterization is that every triangle and every pixel is **independent**. That is why the work parallelises across thousands of GPU cores — the same property, in the same hardware, that later made matrix multiplication for neural networks fast.',
              {
                keyTerms: [
                  { term: 'Rasterization', definition: 'Determining which pixels a triangle covers and shading them.' },
                  { term: 'Depth buffer', definition: 'Per-pixel nearest depth so far, which resolves occlusion in any geometry.' },
                ],
              },
            ),
            interactive(
              'Rasterize a triangle',
              'rasterizer',
              'Drag the vertices and watch which pixel centres fall inside. Note the jagged edge — that staircase is aliasing, and the last lesson in this track is about it.',
            ),
            order(
              'Order the rasterization pipeline.',
              [
                'Transform vertices into screen space',
                'Determine which pixels the triangle covers',
                'Interpolate vertex attributes across those pixels',
                'Run the fragment shader to compute colour',
                'Depth-test and write the nearest result',
              ],
              ['sk-rasterization', 'sk-graphics-pipeline'],
              'Every stage is independent per primitive and per pixel, which is what makes the whole thing parallel.',
            ),
            mcq(
              'Why does the depth buffer beat sorting triangles back to front?',
              [
                'It is more accurate for transparency',
                'It handles intersecting and mutually overlapping geometry, which no sort order can',
                'It uses less memory',
                'It is required by the hardware',
              ],
              1,
              ['sk-rasterization'],
              'Two triangles that pass through each other have no correct draw order. Per-pixel depth has no such problem.',
            ),
            concept(
              'Shading: deciding the colour',
              'Once you know a pixel is covered, something must decide its colour. That is **shading**, and it approximates how light interacts with a surface.\n\nThe classical decomposition has three parts:\n\n**Ambient** — a constant, standing in for all the light that has bounced around the scene. Crude, cheap, and the reason early 3D looked flat.\n\n**Diffuse** — light scattered equally in all directions. Brightness depends on the angle between the surface **normal** and the light direction, via the dot product. This is what gives an object its shape.\n\n**Specular** — the mirror-like highlight, depending on the viewer’s position as well. This is what makes a surface look wet, polished or metallic.\n\nModern engines use **physically based rendering**, which parameterises materials by properties with physical meaning — albedo, roughness, metalness — and enforces energy conservation so a surface cannot reflect more light than it receives. The practical benefit is that a material authored once looks right under every lighting condition, instead of being tuned per scene.\n\nAnd the distinction that matters most visually is **where** shading happens. Per-vertex shading, then interpolating the colours, is cheap and makes curved surfaces look faceted. Per-pixel shading, interpolating the *normal* and computing the lighting at each pixel, is what made smooth curved surfaces possible — and that shift is essentially the history of real-time graphics between 1998 and 2005.',
              {
                keyTerms: [
                  { term: 'Normal', definition: 'The vector perpendicular to a surface, which determines how it catches light.' },
                  { term: 'Physically based rendering', definition: 'Materials described by physical properties, with energy conservation enforced.' },
                ],
              },
            ),
            match(
              'Match each shading term to what it produces.',
              [
                { left: 'Ambient', right: 'A flat base level standing in for bounced light' },
                { left: 'Diffuse', right: 'Shape — brightness from the angle to the light' },
                { left: 'Specular', right: 'The highlight that makes a surface look polished' },
                { left: 'Normal map', right: 'Surface detail without extra geometry' },
              ],
              ['sk-shading'],
              'Diffuse gives form; specular gives material; ambient stops the shadows being pure black.',
            ),
            mcq(
              'Why does per-pixel shading look better than per-vertex on curved surfaces?',
              [
                'It uses more colours',
                'The normal is interpolated and lighting computed per pixel, so curvature is smooth rather than faceted',
                'It runs faster',
                'It supports more lights',
              ],
              1,
              ['sk-shading'],
              'Interpolating the result of lighting is not the same as lighting the interpolated normal, and the difference is exactly the faceting.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-raytracing',
          title: 'Ray Tracing, Textures, and Aliasing',
          summary: 'Following light backwards, painting detail on, and the cost of sampling.',
          level: 'expert',
          domain: 'graphics',
          steps: [
            concept(
              'The other way round',
              'Rasterization asks, for each triangle, which pixels it covers. **Ray tracing** asks the opposite: for each pixel, what is visible along this ray?\n\nCast a ray from the camera through the pixel, find the nearest intersection, and shade it. Because you have a ray and a scene, you can then cast **more** rays from that point: toward each light to test for shadow, in the mirror direction for reflection, through the surface for refraction.\n\nThat is why ray tracing produces effects rasterization struggles with. Shadows, reflections, refraction and ambient occlusion all fall out of the same primitive operation, rather than each needing its own specialised trick.\n\nFull **path tracing** goes further: bounce rays randomly many times and average over many samples per pixel. This converges to a physically correct solution of the rendering equation — genuinely correct global illumination, with colour bleeding between surfaces and soft shadows from area lights. It is also a Monte Carlo method, so it converges as 1/√samples, meaning halving the noise costs four times the rays.\n\nThe historical trade was stark: rasterization is fast and approximate, ray tracing is slow and accurate, so games rasterized and films ray traced. Dedicated ray-tracing hardware since 2018 has blurred it, and real-time renderers now typically rasterize the primary visibility and ray trace the effects that need it.\n\nThe denoisers that make real-time path tracing viable are, notably, neural networks — which is a fair illustration of how thoroughly the two fields have converged.',
              {
                keyTerms: [
                  { term: 'Ray tracing', definition: 'Casting rays from the camera into the scene to find what is visible.' },
                  { term: 'Path tracing', definition: 'Randomly bouncing rays and averaging, converging to physically correct light.' },
                ],
              },
            ),
            interactive(
              'Trace some rays',
              'ray-tracer',
              'Cast rays from the camera and watch them hit, reflect and cast shadow rays. Increase the samples per pixel and watch the noise fall — slowly, because it only improves with the square root.',
            ),
            categorize(
              'Which technique does each naturally?',
              ['Rasterization', 'Ray tracing'],
              [
                { item: 'Very fast primary visibility', category: 'Rasterization' },
                { item: 'Accurate reflections of off-screen objects', category: 'Ray tracing' },
                { item: 'Soft shadows from an area light', category: 'Ray tracing' },
                { item: 'Millions of triangles at 120fps', category: 'Rasterization' },
              ],
              ['sk-ray-tracing'],
              'Modern renderers use both, which is why the debate resolved into a hybrid rather than a winner.',
            ),
            mcq(
              'Path tracing converges as 1/√samples. What does that mean practically?',
              [
                'Doubling samples halves the noise',
                'Halving the noise requires four times the samples',
                'Noise is eliminated after 100 samples',
                'Sample count does not affect noise',
              ],
              1,
              ['sk-ray-tracing'],
              'The same square-root law as statistical sampling, and the reason neural denoisers are used to cheat it.',
            ),
            concept(
              'Textures and the sampling problem',
              'Modelling every surface detail as geometry would be ruinous. A **texture** is an image mapped onto a surface: each vertex carries a UV coordinate into the image, and the rasterizer interpolates them.\n\nTextures carry far more than colour. **Normal maps** perturb the surface normal to fake bumps that catch light correctly without adding a single triangle — the illusion breaks only at silhouettes. Roughness, metalness and ambient-occlusion maps feed the physically based shading model.\n\nThe interesting problem is what happens when a texture is sampled at a different scale than it was authored. A distant surface might cover 4 pixels while its texture is 1024×1024. Each pixel needs the *average* of a large region, and sampling one texel gives a nearly random one from that region — so the surface shimmers violently as the camera moves.\n\n**Mipmaps** solve this: precompute the texture at every halved resolution and sample the level matching the on-screen size. One third more memory, and the shimmer disappears.\n\nThis is **aliasing** — the same phenomenon as the Nyquist problem in signal processing, and the same reason a wagon wheel appears to spin backwards on film. Sampling below the rate the signal demands produces a false lower-frequency pattern.\n\nIt appears throughout graphics:\n\n**Edge aliasing** — the staircase on a triangle edge. Fixed by supersampling, or by a post-process like FXAA, or temporally by jittering samples across frames and accumulating.\n\n**Texture aliasing** — the shimmer. Fixed by mipmaps.\n\n**Temporal aliasing** — flicker between frames. Fixed by accumulating over time, which is what TAA does.\n\nAnd the same idea reappears exactly in the vision track: downsampling an image without blurring first produces aliasing artefacts, which is why a proper resize low-pass filters before decimating.',
              {
                keyTerms: [
                  { term: 'Mipmap', definition: 'Precomputed halved-resolution copies, sampled to match on-screen size.' },
                  { term: 'Aliasing', definition: 'False patterns from sampling below the rate the signal requires.' },
                ],
              },
            ),
            mcq(
              'A distant textured surface shimmers as the camera moves. What fixes it?',
              [
                'A higher-resolution texture',
                'Mipmaps — sample a precomputed lower-resolution level matching the on-screen size',
                'More triangles',
                'Disabling the depth buffer',
              ],
              1,
              ['sk-textures', 'sk-anti-aliasing'],
              'A higher-resolution texture makes it worse: more texels per pixel means a more arbitrary choice each frame.',
            ),
            mcq(
              'What do jagged edges, texture shimmer and a wagon wheel spinning backwards have in common?',
              [
                'Nothing',
                'All are aliasing — sampling below the rate the signal requires',
                'All are compression artefacts',
                'All are gamma errors',
              ],
              1,
              ['sk-anti-aliasing'],
              'One phenomenon, three appearances. The general fix is always the same: filter before sampling, or sample more densely.',
            ),
            multi(
              'Which are anti-aliasing techniques?',
              [
                'Supersampling — render at higher resolution and downsample',
                'Mipmapping textures',
                'Temporal accumulation across jittered frames',
                'Increasing the triangle count',
              ],
              [0, 1, 2],
              ['sk-anti-aliasing'],
              'More triangles adds more edges, and therefore more aliasing rather than less.',
            ),
            shortAnswer(
              'Why did the hardware built for real-time graphics turn out to suit deep learning?',
              ['parallel', 'matrix', 'independent', 'throughput', 'memory'],
              'Because the graphics pipeline is thousands of independent, identical operations: one matrix-vector product per vertex, one shading computation per pixel, with no dependencies between them. That pushed GPU design toward enormous numbers of simple arithmetic units plus very high memory bandwidth to feed them, rather than toward making one sequential task fast. Neural network training happens to be the same shape — dense matrix multiplication with independent elements — so the hardware already existed when the workload arrived.',
              ['sk-graphics-pipeline'],
              'A workload with the same shape arriving after the hardware for it had already been built and refined for twenty years.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-gfx-2',
        title: 'Rendering Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Why is everything triangles?',
            [
              'Tradition',
              'Always planar, always convex, simplest polygon, with unique interpolation across them',
              'They compress well',
              'They use less memory',
            ],
            1,
            ['sk-rasterization'],
            'Every one of those properties makes the hardware simpler.',
          ),
          mcq(
            'What does a mipmap fix?',
            ['Jagged edges', 'Texture shimmer on distant surfaces', 'Gamma errors', 'Depth fighting'],
            1,
            ['sk-textures'],
            'Sampling a level matched to the on-screen size instead of a full-resolution texel.',
          ),
          trueFalse(
            'Path tracing noise halves when you double the sample count.',
            false,
            ['sk-ray-tracing'],
            'It falls as 1/√samples, so halving the noise costs four times the rays.',
          ),
        ],
      },
    },
  ],
};
