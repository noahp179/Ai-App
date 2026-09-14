/**
 * Track 15 — Computer Vision.
 *
 * `computer-vision` was a domain with skills and a widget but no track of its
 * own; convolution was taught as an aside inside Deep Learning and everything
 * after it was missing. This track gives the domain a spine: pixels, filters,
 * hierarchy, architectures, and the two modern branches — transformers and
 * dense prediction.
 */

import type { Track } from '../../domain/types';
import { categorize, concept, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const computerVisionTrack: Track = {
  id: 'track-computer-vision',
  title: 'Computer Vision',
  tagline: 'From pixels to perception',
  description:
    'How a machine turns a grid of numbers into a label, a box, or a mask. Convolution from first principles, the architectures built on it, and what vision transformers changed.',
  domain: 'computer-vision',
  level: 'intermediate',
  icon: '👁️',
  gradient: ['#0EA5E9', '#8B5CF6'],
  prerequisites: ['track-deep-learning'],
  outcomes: [
    'Describe an image the way a model receives it',
    'Compute what a convolution produces and say why weight sharing matters',
    'Explain what pooling buys and what it destroys',
    'Read a CNN architecture and say what each stage is for',
    'Say what vision transformers changed, and when they are the wrong choice',
    'Distinguish classification, detection, and segmentation by their output shape',
  ],
  units: [
    // -----------------------------------------------------------------------
    {
      id: 'unit-cv-1',
      title: 'How a Computer Sees',
      description: 'An image is a tensor. Everything follows from that.',
      lessons: [
        lesson({
          id: 'lesson-image-representation',
          title: 'Images as Numbers',
          summary: 'Before any model touches it, a photo is a three-dimensional array.',
          level: 'intro',
          domain: 'computer-vision',
          free: true,
          steps: [
            concept(
              'Height × width × channels',
              'A colour image is a **three-dimensional array**: height, width, and channels. A 224×224 RGB photo is `224 × 224 × 3` — just over 150,000 numbers, each usually 0–255 before normalisation.\n\nA few consequences fall straight out of that shape.\n\n**The input is enormous.** Flatten that photo and feed it to a dense layer of 1,000 units and you need 150 million weights for one layer. Vision needed a different idea, and convolution is that idea.\n\n**Neighbouring pixels are related.** Pixel (100, 100) is almost always similar to (100, 101). A dense layer knows nothing of this — shuffle the pixels consistently and it learns equally well. Throwing away spatial structure is throwing away most of what an image is.\n\n**Position should not change identity.** A cat in the top-left is the same cat as one in the bottom-right. A dense layer must learn "cat" separately at every location, from separate weights, needing separate examples.\n\nThose three facts are the entire motivation for convolutional networks: reuse a small set of weights across every position, and keep the grid intact while you do it.\n\nOne practical detail worth knowing early: models expect inputs **normalised** to a familiar range — typically each channel scaled to roughly zero mean and unit variance using the statistics of the dataset the model was trained on. Feed 0–255 pixels to a model expecting normalised input and it will not error. It will just be quietly, badly wrong.',
              {
                figure: 'cnn-filters',
                keyTerms: [
                  { term: 'Channel', definition: 'One colour plane of an image, or one feature map inside a network.' },
                  { term: 'Tensor', definition: 'A multi-dimensional array. An image batch is 4D: batch × height × width × channels.' },
                ],
              },
            ),
            numeric(
              'How many numbers are in a single 128×128 RGB image?',
              49152,
              ['sk-image-representation'],
              '`128 × 128 × 3 = 49,152`. Which is why a dense first layer is impractical — even 500 units on this input needs 24.5 million weights, for one layer, to learn something a small set of shared filters captures far better.',
              { hint: 'Three channels for red, green, and blue.' },
            ),
            mcq(
              'Why is a fully connected layer a poor first layer for images?',
              [
                'It cannot represent nonlinear functions',
                'It ignores spatial structure and must learn each pattern separately at every position',
                'It only works with greyscale input',
                'It is slower to compute than convolution at the same parameter count',
              ],
              1,
              ['sk-image-representation'],
              'It throws away the grid. Every position gets its own weights, so a pattern learned in one corner does not transfer to another — and the parameter count explodes while the model learns each location from scratch.',
            ),
            trueFalse(
              'Feeding raw 0–255 pixel values to a model trained on normalised inputs will raise an error.',
              false,
              ['sk-image-representation'],
              'It runs perfectly happily and produces nonsense. The inputs are roughly a hundred times larger than the model expects, so every activation saturates. This is one of the most common silent bugs in a vision pipeline — the failure is a bad prediction, not an exception.',
            ),
            match(
              'Match each tensor shape to what it describes.',
              [
                { left: '(224, 224, 3)', right: 'One RGB image' },
                { left: '(32, 224, 224, 3)', right: 'A batch of 32 RGB images' },
                { left: '(224, 224)', right: 'One greyscale image' },
                { left: '(56, 56, 128)', right: 'A feature map with 128 channels' },
              ],
              ['sk-image-representation'],
              'Reading shapes is the debugging skill in vision exactly as it is in the rest of deep learning — and the batch dimension coming first is a convention worth having automatic.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-convolution-depth',
          title: 'Convolution and Filters',
          summary: 'One small matrix, slid over everything. That is the whole trick.',
          level: 'intermediate',
          domain: 'computer-vision',
          steps: [
            concept(
              'Slide a small window, share the weights',
              'A **convolution** takes a small grid of weights — a **kernel**, typically 3×3 — and slides it across the image. At each position it multiplies elementwise and sums, producing one output number. Slide over every position and you get a **feature map**.\n\nTwo properties do all the work.\n\n**Weight sharing.** The same 9 numbers are used at every position. A 3×3 kernel over a 224×224 image is 9 parameters doing 50,000 multiply-accumulate operations — versus the 2.5 billion weights a dense layer would need for the same input and output size. This is why vision models are trainable at all.\n\n**Translation equivariance.** Because the kernel is the same everywhere, a pattern detected at one location is detected identically at any other. Move the cat, and the feature map moves with it. The model learns "edge" once and applies it 50,000 times.\n\nWhat does a kernel detect? Whatever its weights make it sensitive to. A kernel with negative weights on the left and positive on the right responds strongly to vertical edges and gives zero on flat regions. Crucially, **these are learned, not designed** — early layers reliably converge on edge and colour-blob detectors because those are what the data rewards.\n\nThe three parameters you set: **kernel size** (3×3 is near-universal — two stacked 3×3s see as much as one 5×5 with fewer parameters and an extra nonlinearity), **stride** (step size; 2 halves the output), and **padding** (`same` keeps the size, `valid` shrinks it).',
              {
                keyTerms: [
                  { term: 'Kernel', definition: 'The small grid of learned weights slid across the input.' },
                  { term: 'Feature map', definition: 'The output of one kernel applied at every position.' },
                  { term: 'Equivariance', definition: 'Shift the input and the output shifts the same way.' },
                ],
              },
            ),
            interactive(
              'Slide the kernel yourself',
              'convolution',
              'Step the kernel across the pixels one position at a time and watch each output value computed. Then change the kernel weights and see which structures light up — an edge detector responds at boundaries and returns zero on flat colour.',
            ),
            numeric(
              'A 3×3 kernel with stride 1 and no padding is applied to a 32×32 input. What is the output width?',
              30,
              ['sk-convolution'],
              '`(32 − 3)/1 + 1 = 30`. Without padding each convolution shrinks the map by `kernel − 1`, which is why deep stacks use `same` padding — otherwise a 20-layer network would run out of image.',
              { hint: 'The kernel cannot hang off the edge, so it loses one position per side.' },
            ),
            numeric(
              'How many learnable weights does a 3×3 kernel have when applied to an input with 64 channels (ignoring bias)?',
              576,
              ['sk-convolution'],
              '`3 × 3 × 64 = 576`. A kernel always spans the full depth of its input — it is a 3D block, not a flat square. This is the detail that trips people up when counting parameters for the first time.',
            ),
            mcq(
              'What does weight sharing in a convolution actually buy?',
              [
                'Faster convergence through better initialisation',
                'A pattern learned at one position works at every position, with a tiny fraction of the parameters',
                'Resistance to overfitting through added noise',
                'Support for variable-size inputs only',
              ],
              1,
              ['sk-convolution'],
              'One kernel, applied everywhere. That gives both the enormous parameter saving and translation equivariance, and those two together are the reason convolution beat dense layers on images.',
            ),
            multi(
              'Which are true of convolutional layers? (Select all)',
              [
                'A kernel spans all channels of its input',
                'Stride 2 roughly halves the spatial dimensions of the output',
                'The kernel weights are hand-designed to detect edges',
                'Two stacked 3×3 convolutions have a receptive field comparable to one 5×5',
              ],
              [0, 1, 3],
              ['sk-convolution'],
              'The weights are learned. Early layers converge on edge detectors because that is what minimises the loss — which is a far more interesting fact than if someone had designed them.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-cv-1',
        title: 'Seeing Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'How many numbers are in a 64×64 RGB image?',
            12288,
            ['sk-image-representation'],
            '64 × 64 × 3 = 12,288. Small by modern standards, and still far too many for a dense first layer to handle sensibly.',
          ),
          mcq(
            'What does weight sharing in a convolution buy?',
            [
              'Faster convergence through better initialisation',
              'A pattern learned once works at every position, with a tiny fraction of the parameters',
              'Protection against overfitting through noise',
              'Support for variable-size inputs only',
            ],
            1,
            ['sk-convolution'],
            'One kernel applied everywhere gives both the parameter saving and translation equivariance — the two reasons convolution beat dense layers on images.',
          ),
          trueFalse(
            'A convolution kernel spans only one channel of its input.',
            false,
            ['sk-convolution'],
            'It spans the full input depth. A 3×3 kernel over 64 channels holds 3 × 3 × 64 = 576 weights — it is a block, not a flat square.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-cv-2',
      title: 'Deep Vision',
      description: 'Stacking convolutions into something that recognises a cat.',
      lessons: [
        lesson({
          id: 'lesson-pooling',
          title: 'Pooling and Hierarchy',
          summary: 'Throw away resolution on purpose, and gain a field of view.',
          level: 'intermediate',
          domain: 'computer-vision',
          steps: [
            concept(
              'Why deliberately lose information',
              '**Pooling** downsamples a feature map — max pooling takes the largest value in each 2×2 window, halving both dimensions and discarding three quarters of the numbers.\n\nDestroying three quarters of your data sounds like a mistake. It buys three things.\n\n**A growing receptive field.** A 3×3 kernel sees 3×3 pixels. Stack another after pooling and it sees 3×3 of a map where each cell already summarised 2×2 — so it effectively sees a much larger region of the original image. **Alternating convolution and downsampling is how a network with only small kernels ends up seeing the whole picture.** By layer 20 a single unit\'s receptive field can cover the entire input.\n\n**Some translation invariance.** Max pooling returns the same value whether the strong activation was at the top-left or the bottom-right of its window. Small shifts stop mattering. Note the distinction from convolution, which is *equivariant* — the response moves with the input. Pooling converts some of that equivariance into invariance, which is what classification wants.\n\n**Compute.** Each pooling step quarters the spatial work for everything downstream.\n\nThe cost is real: **precise location is gone.** Fine for "is there a cat", fatal for "outline the cat" — which is why segmentation architectures either avoid pooling or carefully reconstruct what it destroyed.\n\nModern architectures often use **strided convolutions** instead, achieving the same downsampling with learned weights rather than a fixed max. And nearly all of them end with **global average pooling** — collapse each channel to a single number — rather than flattening into a huge dense layer, which cut parameter counts dramatically.',
              {
                keyTerms: [
                  { term: 'Receptive field', definition: 'The region of the original input that influences one unit’s output.' },
                  { term: 'Invariance', definition: 'The output does not change when the input shifts. Contrast with equivariance.' },
                ],
              },
            ),
            mcq(
              'What is the main reason pooling appears between convolution blocks?',
              [
                'To add nonlinearity',
                'To grow the receptive field so later layers see larger regions of the original image',
                'To prevent vanishing gradients',
                'To normalise the activations',
              ],
              1,
              ['sk-pooling'],
              'Downsampling is what lets a stack of small kernels eventually cover the whole image. Invariance and cheaper compute are real bonuses, but the receptive field is the structural reason.',
            ),
            numeric(
              'A 64×64 feature map passes through three 2×2 max-pooling layers. What is the resulting width?',
              8,
              ['sk-pooling'],
              '64 → 32 → 16 → 8. Each pooling halves it. This is the standard pyramid: spatial resolution falls while channel depth rises, so the representation moves from "where things are" toward "what is present".',
            ),
            mcq(
              'Why do segmentation architectures avoid or compensate for aggressive pooling?',
              [
                'Pooling is too slow',
                'Segmentation needs per-pixel output, and pooling discards the precise location that pooling-free layers preserve',
                'Pooling only works on square inputs',
                'Pooling prevents the use of skip connections',
              ],
              1,
              ['sk-object-detection', 'sk-pooling'],
              'Classification needs one label and can afford to forget where. Segmentation needs a label per pixel, so the location information pooling throws away is exactly the output. U-Net\'s skip connections exist to carry that detail across from the downsampling path to the upsampling one.',
            ),
            categorize(
              'Sort each property by whether it describes convolution or pooling.',
              ['Convolution', 'Pooling'],
              [
                { item: 'Has learnable weights', category: 'Convolution' },
                { item: 'Shifts the output when the input shifts', category: 'Convolution' },
                { item: 'Reduces spatial dimensions with no parameters', category: 'Pooling' },
                { item: 'Makes the output insensitive to small shifts', category: 'Pooling' },
              ],
              ['sk-convolution', 'sk-pooling'],
              'Equivariance versus invariance is the distinction worth keeping: convolution tracks where a feature is, pooling stops caring.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-cnn-architectures',
          title: 'CNN Architectures',
          summary: 'Five architectures, five ideas that each unlocked the next.',
          level: 'expert',
          domain: 'computer-vision',
          steps: [
            concept(
              'The lineage, and what each one added',
              'Vision architectures are best learned as a sequence of problems and fixes.\n\n**LeNet-5 (1998).** Convolution, pooling, dense head. The template, on handwritten digits. Correct, and about fifteen years too early — the data and the GPUs were not there.\n\n**AlexNet (2012).** The same shape, much bigger, on ImageNet, on two GPUs. Halved the error rate of the best hand-engineered system and ended the argument about learned features. Introduced **ReLU** at scale (trainable where sigmoid saturated) and **dropout**.\n\n**VGG (2014).** One disciplined idea: use only 3×3 convolutions and go deep. Two 3×3s cover what one 5×5 does with fewer parameters and an extra nonlinearity. Established 3×3 as the default it still is.\n\n**Inception / GoogLeNet (2014).** Why choose a kernel size? Run 1×1, 3×3 and 5×5 in parallel and concatenate. Also popularised the **1×1 convolution** — which mixes channels without touching space, and is the standard way to cut channel depth before an expensive operation.\n\n**ResNet (2015).** The one that mattered most. Deeper networks had started performing *worse* — not from overfitting, but because gradients could not reach the early layers. The fix was almost trivially simple: `output = F(x) + x`. A **residual connection** gives the gradient an unobstructed path around every block, and suddenly 152 layers trained fine where 30 had not. Residual connections are now in essentially everything, transformers included.\n\nAfter ResNet the story turns to efficiency — **MobileNet** and depthwise separable convolutions, **EfficientNet** and principled scaling — and then to transformers.',
              { figure: 'cnn-filters' },
            ),
            order(
              'Order these architectures by what each one introduced.',
              [
                'LeNet: convolution and pooling as a trainable stack',
                'AlexNet: depth plus ReLU and dropout, at ImageNet scale',
                'VGG: uniform 3×3 convolutions, stacked deep',
                'Inception: parallel kernel sizes and 1×1 channel mixing',
                'ResNet: residual connections that let gradients skip blocks',
              ],
              ['sk-cnn-architecture'],
              'Each step responded to a limitation the previous one exposed. The residual connection is the one that generalised furthest — it is in transformers, diffusion U-Nets, and nearly every deep architecture since.',
            ),
            mcq(
              'Very deep plain CNNs performed worse than shallower ones — even on training data. What was the cause?',
              [
                'Overfitting to the training set',
                'Gradients degraded on their way back through many layers, so early layers barely learned',
                'Insufficient training data',
                'The learning rate was too high',
              ],
              1,
              ['sk-cnn-architecture', 'sk-vanishing-gradients'],
              'Worse *training* error rules out overfitting — the network could not fit the data it had. Residual connections gave gradients a direct route back, and the same depth suddenly trained.',
            ),
            mcq(
              'What is a 1×1 convolution for?',
              [
                'Detecting single pixels',
                'Mixing information across channels and changing channel depth without touching spatial structure',
                'Downsampling the feature map',
                'Adding nonlinearity only',
              ],
              1,
              ['sk-cnn-architecture'],
              'It is a per-position linear combination across channels — a cheap way to cut 256 channels to 64 before an expensive 3×3, which is exactly how Inception and every bottleneck block since keep the cost down.',
            ),
            multi(
              'Which are true of residual connections? (Select all)',
              [
                'They add the block’s input to its output',
                'They give gradients a path that skips the block’s transformations',
                'They increase the parameter count substantially',
                'They made networks past 100 layers trainable',
              ],
              [0, 1, 3],
              ['sk-cnn-architecture'],
              'The addition is parameter-free, which is part of what makes the idea so striking: an enormous gain in trainability for essentially no cost.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-cv-2',
        title: 'Deep Vision Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Why does pooling appear between convolution blocks?',
            [
              'To add nonlinearity',
              'To grow the receptive field so later layers see larger regions of the original image',
              'To prevent vanishing gradients',
              'To normalise activations',
            ],
            1,
            ['sk-pooling'],
            'Downsampling is what lets a stack of small kernels eventually cover the whole image. Invariance and cheaper compute are bonuses.',
          ),
          numeric(
            'A 128×128 feature map passes through four 2×2 pooling layers. What is the resulting width?',
            8,
            ['sk-pooling'],
            '128 → 64 → 32 → 16 → 8. Spatial resolution falls while channel depth rises.',
          ),
          mcq(
            'Very deep plain CNNs had worse training error than shallower ones. What fixed it?',
            [
              'More data',
              'Residual connections giving gradients a path around each block',
              'Batch normalization alone',
              'Smaller kernels',
            ],
            1,
            ['sk-cnn-architecture'],
            'Worse training error rules out overfitting — the gradient could not reach the early layers. ResNet’s parameter-free F(x) + x fixed it.',
          ),
        ],
      },
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-cv-3',
      title: 'Modern Vision',
      description: 'Transformers arrive, and the output stops being a single label.',
      lessons: [
        lesson({
          id: 'lesson-vision-transformers',
          title: 'Vision Transformers',
          summary: 'Cut the image into patches, treat them as tokens, drop the convolutions.',
          level: 'expert',
          domain: 'computer-vision',
          steps: [
            concept(
              'An image is a sequence of patches',
              'The **Vision Transformer** does something that sounds like it should not work: split the image into fixed patches — 16×16 pixels each — flatten every patch into a vector, add a positional embedding, and feed the sequence to a standard transformer encoder. No convolutions at all.\n\nA 224×224 image becomes 196 patches, which is a sequence length transformers handle comfortably. Self-attention then lets **any patch attend to any other patch in the very first layer** — global context immediately, where a CNN needs many layers of stacking before two distant pixels can influence each other.\n\nThe catch, and it is a big one: **ViTs need far more data than CNNs.** A convolution has translation equivariance and locality built into its structure — a strong **inductive bias** that is correct for images and comes free. A transformer has almost none; it must learn from data that nearby patches are related and that a shifted cat is still a cat.\n\nSo the original ViT underperformed ResNets on ImageNet alone and beat them decisively after pretraining on 300 million images. The rule of thumb that emerged:\n\n- **Limited data, no pretrained weights** → a CNN, usually still the right answer.\n- **Large-scale pretraining available** → ViT scales better and keeps improving where CNNs plateau.\n- **Multimodal work** → ViT, because the output is already a token sequence a language model can consume.\n\nHybrids are common in practice. Swin Transformer reintroduces locality with windowed attention; ConvNeXt takes a ResNet and applies transformer-era training recipes, recovering much of the gap — which suggests a good deal of the original difference was training method rather than architecture.',
              {
                figure: 'attention-heads',
                keyTerms: [
                  { term: 'Patch embedding', definition: 'A flattened image patch projected into the transformer’s dimension. The vision equivalent of a token.' },
                  { term: 'Inductive bias', definition: 'Assumptions built into an architecture. Convolution assumes locality and translation equivariance.' },
                ],
              },
            ),
            numeric(
              'A 224×224 image is split into 16×16 patches. How many patches is that?',
              196,
              ['sk-vision-transformers'],
              '`(224/16)² = 14² = 196`. A very manageable sequence length — which is exactly why 16×16 was chosen. Halve the patch size to 8 and you get 784 tokens and roughly 16× the attention cost, since attention is quadratic in sequence length.',
            ),
            mcq(
              'Why do vision transformers need more training data than CNNs?',
              [
                'They have more parameters',
                'They lack convolution’s built-in assumptions of locality and translation equivariance, so they must learn them',
                'Attention is harder to optimise',
                'They cannot use data augmentation',
              ],
              1,
              ['sk-vision-transformers'],
              'Convolution hands the model two facts about images for free. A transformer starts without them and has to discover them from examples — which is a disadvantage on small datasets and an advantage at scale, because nothing constrains what else it can learn.',
            ),
            interactive(
              'See what attends to what',
              'attention-matrix',
              'Trace which positions a token attends to. A vision transformer does exactly this over image patches — and from the first layer onward, any patch can attend to any other.',
            ),
            match(
              'Match each situation to the better starting architecture.',
              [
                { left: '5,000 labelled medical images, no pretrained weights', right: 'CNN' },
                { left: 'Pretraining on hundreds of millions of images', right: 'Vision transformer' },
                { left: 'An image encoder feeding a language model', right: 'Vision transformer' },
                { left: 'Real-time inference on a phone', right: 'Efficient CNN' },
              ],
              ['sk-vision-transformers', 'sk-cnn-architecture'],
              'The inductive bias that limits a CNN at scale is exactly what rescues it when data is scarce. Neither is simply better.',
            ),
            trueFalse(
              'Vision transformers process image patches in an order-independent way unless positional information is added.',
              true,
              ['sk-vision-transformers'],
              'Self-attention is permutation-invariant, so without positional embeddings the model would see an unordered bag of patches — a scrambled image would be identical to the original. The same reason positional encoding exists in language transformers.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-detection-segmentation',
          title: 'Detection and Segmentation',
          summary: 'When "there is a cat" is not enough — where, and which pixels?',
          level: 'expert',
          domain: 'computer-vision',
          steps: [
            concept(
              'Four tasks, four output shapes',
              'The task is defined by the shape of the output, and that shape determines the whole architecture.\n\n**Classification** → one label for the image. *"Cat."*\n\n**Object detection** → a set of boxes, each with a class and a confidence. *"Cat at (120, 80, 200, 260), 0.94."* The output is variable-length, which is the hard part: the network must decide how many objects there are.\n\n**Semantic segmentation** → a class for every pixel. *"These pixels are cat, those are sofa."* Same resolution out as in. It cannot distinguish two adjacent cats — they are one region of "cat" pixels.\n\n**Instance segmentation** → a mask per object. *"This mask is cat #1, that one is cat #2."* Detection and segmentation combined, and the most expensive.\n\nThe architectural families that follow:\n\n**Two-stage detectors** (R-CNN → Faster R-CNN) propose regions, then classify each. Accurate, slower.\n\n**Single-stage detectors** (YOLO, SSD, RetinaNet) predict boxes and classes in one pass over a grid. Fast enough for video, historically a little less accurate — a gap that has largely closed.\n\n**Encoder–decoder segmentation** (U-Net) downsamples to understand context, then upsamples back to full resolution, with **skip connections** carrying fine detail across from the encoder. Without those skips the output is a blurry approximation; U-Net\'s shape exists precisely to recover what pooling destroyed.\n\n**DETR** reframes detection as set prediction with a transformer, removing the hand-tuned anchor boxes and non-maximum suppression that everything before it required.\n\nOne evaluation note: detection is scored with **IoU** — intersection over union of predicted and true boxes — thresholded, usually at 0.5, and summarised as **mAP** across classes and thresholds.',
              {
                keyTerms: [
                  { term: 'IoU', definition: 'Overlap between predicted and true regions, divided by their union.' },
                  { term: 'Skip connection', definition: 'In U-Net, a path carrying high-resolution detail from encoder to decoder.' },
                ],
              },
            ),
            categorize(
              'Sort each requirement by the task it needs.',
              ['Classification', 'Object detection', 'Semantic segmentation', 'Instance segmentation'],
              [
                { item: 'Tag a photo library by what is in each picture', category: 'Classification' },
                { item: 'Count and locate every car in a car park', category: 'Object detection' },
                { item: 'Colour every pixel of road, pavement, and sky', category: 'Semantic segmentation' },
                { item: 'Outline each individual cell in a microscopy image', category: 'Instance segmentation' },
              ],
              ['sk-object-detection'],
              'Counting needs separable instances, so semantic segmentation is not enough for the car park — two touching cars would merge into one region.',
            ),
            numeric(
              'A predicted box and the true box overlap over 30 pixels and together cover 120 pixels. What is the IoU?',
              0.25,
              ['sk-object-detection'],
              '`30 / 120 = 0.25`. Below the usual 0.5 threshold, so this counts as a miss — and because the union is in the denominator, a box that is far too large is penalised just as a box that is far too small.',
              { tolerance: 0.01 },
            ),
            mcq(
              'What do U-Net’s skip connections contribute?',
              [
                'They prevent overfitting',
                'They carry high-resolution spatial detail from the encoder to the decoder, which downsampling destroyed',
                'They reduce the parameter count',
                'They allow variable-size inputs',
              ],
              1,
              ['sk-object-detection'],
              'The encoder learns what is present by discarding where; the decoder needs the where back. The skips supply it, which is why U-Net produces crisp boundaries and a plain encoder–decoder produces blurry ones.',
            ),
            shortAnswer(
              'Why is object detection architecturally harder than classification?',
              ['variable', 'number', 'how many', 'boxes', 'location', 'set'],
              'Because the output is a variable-length set rather than a fixed-size vector. The network must decide how many objects are present as well as what and where they are, and a fixed output layer cannot express "three objects" and "zero objects" naturally. Anchor boxes, non-maximum suppression, and set-prediction losses all exist to work around that.',
              ['sk-object-detection'],
              'DETR’s contribution was treating it as set prediction directly, which let it drop the hand-tuned machinery everything before it needed.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-cv-3',
        title: 'Computer Vision Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'A 3×3 kernel is applied to an input with 32 channels. How many weights, ignoring bias?',
            288,
            ['sk-convolution'],
            '`3 × 3 × 32 = 288`. The kernel always spans the full input depth.',
          ),
          mcq(
            'What made networks deeper than about 30 layers trainable?',
            [
              'Better GPUs',
              'Residual connections giving gradients a path around each block',
              'Larger datasets',
              'Batch normalization alone',
            ],
            1,
            ['sk-cnn-architecture'],
            'ResNet’s `F(x) + x`. Parameter-free, and it turned degradation with depth into improvement with depth.',
          ),
          mcq(
            'Why do vision transformers underperform CNNs on small datasets?',
            [
              'They are too large to fit in memory',
              'They lack the locality and translation-equivariance assumptions a convolution provides for free',
              'Attention cannot process images',
              'They require square inputs',
            ],
            1,
            ['sk-vision-transformers'],
            'No inductive bias means everything must come from data. Given enough of it, that becomes the advantage.',
          ),
        ],
      },
    },
  ],
};
