/** Track 3 — Neural Networks & Deep Learning. Intermediate → expert. */

import type { Track } from '../../domain/types';
import { codeOutput, concept, fill, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const deepLearningTrack: Track = {
  id: 'track-deep-learning',
  title: 'Neural Networks & Deep Learning',
  tagline: 'From one neuron to deep architectures',
  description:
    'Build the intuition and the mechanics: what a neuron computes, how backpropagation assigns blame across a hundred layers, and why depth changed everything.',
  domain: 'deep-learning',
  level: 'intermediate',
  icon: '🧠',
  gradient: ['#8B5CF6', '#EC4899'],
  prerequisites: ['track-machine-learning'],
  outcomes: [
    'Trace a forward pass through a small network by hand',
    'Explain backpropagation as the chain rule applied backwards',
    'Choose activations, optimizers, and normalization deliberately',
    'Diagnose vanishing gradients and training instability',
  ],
  units: [
    {
      id: 'unit-dl-1',
      title: 'The Neuron',
      description: 'The unit everything else is made of.',
      lessons: [
        lesson({
          id: 'lesson-perceptron',
          title: 'One Artificial Neuron',
          summary: 'Multiply, sum, bend. That is the whole thing.',
          level: 'intro',
          domain: 'deep-learning',
          free: true,
          steps: [
            concept(
              'Three operations',
              'An artificial neuron does exactly three things:\n\n1. **Multiply** each input by a weight.\n2. **Sum** the results and add a bias.\n3. **Bend** the sum with a nonlinear activation function.\n\n`output = f(w₁x₁ + w₂x₂ + ... + b)`\n\nSteps 1 and 2 are a dot product — the same linear model from the last track. Step 3 is the only genuinely new idea, and it is the one that makes depth worth anything.\n\nThe biological analogy is loose to the point of being misleading. Real neurons spike in time, have complex dendritic computation, and do not do backpropagation. Treat "neuron" as a name, not a claim.',
              {
                figure: 'neuron-anatomy',
                keyTerms: [
                  { term: 'Activation function', definition: 'The nonlinearity applied to a neuron\'s weighted sum.' },
                  { term: 'Pre-activation', definition: 'The weighted sum before the activation is applied. Often written z.' },
                ],
              },
            ),
            numeric(
              'Inputs [2, 3], weights [0.5, −1], bias 1. What is the pre-activation z?',
              -1,
              ['sk-perceptron', 'sk-vectors'],
              '(2 × 0.5) + (3 × −1) + 1 = 1 − 3 + 1 = −1. With ReLU this neuron would output 0 — it stays silent for this input.',
              { hint: 'Dot product, then add the bias.' },
            ),
            interactive(
              'Move the boundary',
              'perceptron',
              'Drag the weights and bias and watch the decision boundary move. Weights rotate the line; the bias slides it. Then try the XOR dataset — no setting of a single neuron separates it, which is precisely why we need layers.',
            ),
            concept(
              'Why nonlinearity is non-negotiable',
              'Stack two linear layers and you get:\n\n`W₂(W₁x + b₁) + b₂ = (W₂W₁)x + (W₂b₁ + b₂)`\n\nThat is *another linear function*. A hundred linear layers collapse into one. All that depth buys you nothing.\n\nInsert a nonlinearity between them and the collapse is blocked. Each layer can now warp the space before passing it on, and composing those warps builds arbitrarily complex decision boundaries. The **universal approximation theorem** says even one hidden layer with enough units can approximate any continuous function — though "enough" can be astronomically many, which is why depth beats width in practice.',
            ),
            mcq(
              'What happens if you remove all activation functions from a 50-layer network?',
              [
                'It trains faster with the same capacity',
                'It collapses to an equivalent single linear layer',
                'The gradients explode',
                'It can only do classification',
              ],
              1,
              ['sk-activation-functions'],
              'Composition of linear maps is linear. The 50 layers are mathematically equivalent to one, so the network cannot represent anything a linear model could not.',
            ),
            concept(
              'Choosing an activation',
              '**ReLU** — `max(0, z)`. Cheap, no saturation for positive inputs, and the default for hidden layers since 2012. Its weakness is the *dying ReLU*: a unit stuck outputting zero has zero gradient and can never recover.\n\n**Leaky ReLU / GELU** — small negative slope, or a smooth probabilistic gate. GELU is standard in transformers.\n\n**Sigmoid** — saturates at both ends, so gradients vanish in deep stacks. Now used only for binary output layers.\n\n**Tanh** — zero-centred sigmoid. Better than sigmoid, still saturates. Lives on in some recurrent architectures.\n\n**Softmax** — output layer only, for multi-class. Converts logits into probabilities that sum to 1.\n\nRule of thumb: **ReLU or GELU in the hidden layers, and let the task pick the output activation.**',
            ),
            interactive(
              'Plot the activations',
              'activation-explorer',
              'Switch between ReLU, sigmoid, tanh, GELU, and leaky ReLU, and watch each function alongside its derivative. The derivative panel is the important one — where it flattens is where gradients die.',
            ),
            match(
              'Match each activation to where it belongs.',
              [
                { left: 'Hidden layers of a CNN', right: 'ReLU' },
                { left: 'Hidden layers of a transformer', right: 'GELU' },
                { left: 'Binary classification output', right: 'Sigmoid' },
                { left: 'Multi-class output over 10 classes', right: 'Softmax' },
              ],
              ['sk-activation-functions'],
              'Hidden layers want cheap, non-saturating functions. Output layers want whatever produces the right shape of number for the loss.',
            ),
            trueFalse(
              'Softmax outputs are probabilities, so a 0.97 softmax score means the model is 97% likely to be right.',
              false,
              ['sk-activation-functions'],
              'Softmax outputs *sum to one*, which makes them look like probabilities, but they are typically badly calibrated — modern networks are systematically overconfident. Getting a stated 0.97 to mean "right 97% of the time" requires explicit calibration, such as temperature scaling on a held-out set.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-mlp',
          title: 'Stacking Into Layers',
          summary: 'How networks build features out of features.',
          level: 'intermediate',
          domain: 'deep-learning',
          steps: [
            concept(
              'Layers of representation',
              'A **multilayer perceptron** is neurons arranged in layers, each fully connected to the next.\n\n- **Input layer** — your raw features.\n- **Hidden layers** — learned intermediate representations.\n- **Output layer** — shaped by the task.\n\nWhat makes this powerful is the hierarchy the network learns without being told. In a vision network, early layers respond to edges, middle layers to textures and parts, later layers to whole objects. Nobody designed that progression; it falls out of minimising the loss.\n\nThat is the actual meaning of **representation learning**, and it is why deep learning displaced decades of hand-engineered features.',
              { figure: 'mlp-layers' },
            ),
            numeric(
              'A layer maps 128 inputs to 64 outputs, fully connected with a bias per output. How many parameters?',
              8256,
              ['sk-mlp'],
              'Weights: 128 × 64 = 8,192. Biases: 64. Total 8,256. Fully connected layers dominate parameter counts, which is what motivated weight sharing in convolutions.',
              { hint: 'inputs × outputs, plus one bias per output.' },
            ),
            interactive(
              'Train a network live',
              'neural-net-trainer',
              'Choose a dataset (XOR, circles, spirals), set the layers, and press train. Watch the loss curve fall and the decision boundary bend. Try XOR with zero hidden layers first — it can never work, and seeing it fail is the point.',
            ),
            codeOutput(
              'What shape does this print?',
              'python',
              `import numpy as np

batch = np.random.randn(32, 128)   # 32 examples, 128 features
W = np.random.randn(128, 64)
b = np.zeros(64)

h = np.maximum(0, batch @ W + b)   # ReLU
print(h.shape)`,
              ['(32, 64)', '(128, 64)', '(32, 128)', '(64, 32)'],
              0,
              ['sk-forward-pass', 'sk-matrices'],
              'Matrix multiply (32, 128) @ (128, 64) contracts the shared 128 dimension, giving (32, 64). The batch dimension passes through untouched — every example flows through the same weights independently.',
            ),
            order(
              'Order the forward pass through one hidden layer.',
              [
                'Multiply the input by the weight matrix',
                'Add the bias vector',
                'Apply the activation function',
                'Pass the result to the next layer',
              ],
              ['sk-forward-pass'],
              'Linear transform, shift, bend, forward. Every layer in every network you will meet is a variation on this.',
            ),
            concept(
              'Wider or deeper?',
              'Both add capacity, differently.\n\n**Wider** layers memorise more and compute in parallel efficiently, but capacity grows linearly with width while parameters grow quadratically between two wide layers.\n\n**Deeper** networks compose transformations, which is exponentially more expressive per parameter. Some functions need exponentially more units to represent with one hidden layer than with several.\n\nDepth is why it is called *deep* learning. It also brought the problems the rest of this track is about: vanishing gradients, training instability, and the normalization and residual tricks invented to fix them.',
            ),
            mcq(
              'Why is depth generally more parameter-efficient than width?',
              [
                'Deep networks train faster',
                'Composition of transformations is exponentially more expressive per parameter',
                'Deep networks need less data',
                'Wide networks cannot use GPUs',
              ],
              1,
              ['sk-mlp'],
              'Each layer can reuse the features built by the layer below. Representing the same function with a single hidden layer can require exponentially more units.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-dl-1',
        title: 'Neuron Checkpoint',
        passingScore: 0.7,
        exercises: [
          numeric(
            'Inputs [1, 2, 3], weights [0.5, 0.5, −1], bias 2. What does a ReLU neuron output?',
            0.5,
            ['sk-perceptron'],
            'z = 0.5 + 1 − 3 + 2 = 0.5. ReLU(0.5) = 0.5, since the pre-activation is positive.',
            { tolerance: 0.01 },
          ),
          mcq(
            'Which activation is the standard default for hidden layers in a modern CNN?',
            ['Sigmoid', 'ReLU', 'Softmax', 'Linear'],
            1,
            ['sk-activation-functions'],
            'ReLU is cheap and does not saturate for positive inputs. Softmax is an output activation; sigmoid saturates; linear defeats the point of depth.',
          ),
          trueFalse(
            'A network with only linear activations can learn XOR.',
            false,
            ['sk-activation-functions'],
            'XOR is not linearly separable, and a purely linear network collapses to a single linear map. It needs a nonlinearity and a hidden layer.',
          ),
        ],
      },
    },

    {
      id: 'unit-dl-2',
      title: 'Training Deep Networks',
      description: 'Backpropagation, optimizers, and what goes wrong at depth.',
      lessons: [
        lesson({
          id: 'lesson-backprop',
          title: 'Backpropagation',
          summary: 'Assigning blame backwards through the network.',
          level: 'expert',
          domain: 'deep-learning',
          steps: [
            concept(
              'The credit assignment problem',
              'A network has millions of parameters and one loss number. To improve, you need `∂L/∂w` for **every** weight — how much each one contributed to the error.\n\nComputing each derivative independently would take millions of forward passes. Backpropagation gets all of them in a **single backward pass**, at roughly the cost of one forward pass.\n\nThe trick is the chain rule plus reuse. Gradients computed for layer 5 are exactly what layer 4 needs to compute its own, so you sweep backwards from the loss, multiplying local derivatives as you go, and every intermediate result gets used.\n\nThis efficiency is the reason deep learning is possible at all. Without it, training a modern network would take longer than the age of the universe.',
              { keyTerms: [{ term: 'Backpropagation', definition: 'Reverse-mode automatic differentiation applied to a neural network.' }, { term: 'Computational graph', definition: 'The DAG of operations recorded during the forward pass and traversed backwards.' }] },
            ),
            concept(
              'The chain rule, concretely',
              'Suppose `L = (y − ŷ)²`, `ŷ = f(z)`, and `z = wx + b`. To get `∂L/∂w`, chain through:\n\n`∂L/∂w = ∂L/∂ŷ × ∂ŷ/∂z × ∂z/∂w`\n\nEach factor is a *local* derivative — something each operation knows how to compute about itself, without knowing anything about the rest of the network.\n\nThat locality is the design insight. Every operation implements two methods: a forward that computes its output, and a backward that turns an incoming gradient into outgoing gradients. Wire them together and differentiation happens automatically, however complicated the network is. This is what every framework calls **autograd**.',
            ),
            order(
              'Order one full training step.',
              [
                'Forward pass: compute activations layer by layer and cache them',
                'Compute the loss against the true labels',
                'Backward pass: propagate gradients from the loss back to every parameter',
                'Optimizer updates each parameter using its gradient',
              ],
              ['sk-backpropagation'],
              'Forward, loss, backward, update. Caching activations during the forward pass is why training uses far more memory than inference.',
            ),
            mcq(
              'Why does training a network use much more memory than running it?',
              [
                'Gradients are larger than weights',
                'Forward activations must be cached for the backward pass',
                'The optimizer duplicates the dataset',
                'Training uses higher precision throughout',
              ],
              1,
              ['sk-backpropagation'],
              'Every intermediate activation is needed to compute local gradients on the way back, so it must be kept alive until then. **Gradient checkpointing** trades compute for memory by recomputing some activations instead of storing them.',
            ),
            numeric(
              'With ∂L/∂ŷ = 2, ∂ŷ/∂z = 0.5, and ∂z/∂w = 3, what is ∂L/∂w?',
              3,
              ['sk-backpropagation', 'sk-chain-rule'],
              '2 × 0.5 × 3 = 3. The chain rule multiplies local derivatives along the path — which is exactly why long chains of small factors cause gradients to vanish.',
            ),
            concept(
              'Vanishing and exploding gradients',
              'That multiplication is the problem. Chain 50 local derivatives of 0.5 and you get 0.5⁵⁰ ≈ 10⁻¹⁵ — the early layers receive effectively **no** gradient and stop learning. Chain factors of 1.5 instead and you get 10⁸: gradients explode, weights blow up, loss becomes NaN.\n\nSaturating activations like sigmoid have derivatives capped at 0.25, which made deep networks nearly untrainable before 2012. The fixes, in rough order of importance:\n\n- **ReLU-family activations** — derivative of exactly 1 for positive inputs.\n- **Residual connections** — `output = F(x) + x` gives gradients an unobstructed path around each block. This is what made 100+ layer networks trainable.\n- **Normalization layers** — keep activations in a well-conditioned range.\n- **Careful initialization** — He and Xavier schemes set initial weight variance so signal neither grows nor shrinks per layer.\n- **Gradient clipping** — cap the gradient norm. The standard defence against explosion.',
            ),
            multi(
              'Which help with vanishing gradients? (Select all)',
              [
                'Residual (skip) connections',
                'Replacing sigmoid with ReLU in hidden layers',
                'Batch normalization',
                'Increasing the number of layers',
              ],
              [0, 1, 2],
              ['sk-vanishing-gradients'],
              'Skip connections give gradients a direct path, ReLU avoids saturation, and normalization keeps activations well-scaled. Adding layers makes the chain longer and the problem worse.',
            ),
            shortAnswer(
              'Explain in your own words why residual connections make very deep networks trainable.',
              ['gradient', 'path', 'identity', 'skip', 'vanish'],
              'A residual block computes F(x) + x, so the gradient flows through the identity path unchanged in addition to the transformed path. Even if F contributes very little gradient, the skip path keeps the signal alive, so early layers still receive a usable gradient.',
              ['sk-vanishing-gradients'],
              'The `+ x` term has a derivative of exactly 1, giving gradients a route that no amount of depth can attenuate.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-optimizers',
          title: 'Optimizers',
          summary: 'Why nobody uses plain gradient descent any more.',
          level: 'expert',
          domain: 'deep-learning',
          steps: [
            concept(
              'Beyond the naive step',
              'Plain SGD takes the same size step in every direction, which is a poor fit for real loss landscapes — they have ravines that are steep across and nearly flat along, and one global step size cannot serve both.\n\n**Momentum** accumulates a velocity: `v ← βv + ∇L`, then `w ← w − ηv`. Consistent directions build speed; oscillating ones cancel. A heavy ball rolling downhill rather than a hiker re-deciding each step.\n\n**RMSProp** scales each parameter\'s step by the recent magnitude of its own gradients, so rarely-updated parameters get proportionally larger steps.\n\n**Adam** combines both — momentum on the gradient and per-parameter scaling — plus a bias correction for the first few steps. It is the default for a reason: it works acceptably almost everywhere with almost no tuning.\n\n**AdamW** decouples weight decay from the gradient update, which turns out to matter a lot for transformers. It is the standard choice for training large models today.',
              { keyTerms: [{ term: 'Momentum', definition: 'An exponentially-weighted running average of past gradients.' }, { term: 'AdamW', definition: 'Adam with decoupled weight decay. Standard for transformer training.' }] },
            ),
            match(
              'Match each optimizer to its defining idea.',
              [
                { left: 'Fixed step along the raw gradient', right: 'SGD' },
                { left: 'Accumulates velocity across steps', right: 'Momentum' },
                { left: 'Per-parameter step scaling from squared gradients', right: 'RMSProp' },
                { left: 'Momentum plus per-parameter scaling', right: 'Adam' },
              ],
              ['sk-optimizers'],
              'Adam is essentially momentum and RMSProp composed, with bias correction so the early estimates are not skewed toward zero.',
            ),
            mcq(
              'Why does Adam usually converge faster than plain SGD early in training?',
              [
                'It uses a larger learning rate',
                'It adapts the step size per parameter and smooths the direction with momentum',
                'It computes exact second derivatives',
                'It skips the backward pass sometimes',
              ],
              1,
              ['sk-optimizers'],
              'Per-parameter scaling handles wildly different gradient magnitudes across layers, and momentum smooths a noisy mini-batch direction. Adam approximates curvature information cheaply — it does not compute the true Hessian, which would be intractable.',
            ),
            concept(
              'Learning-rate schedules',
              'A constant learning rate is rarely right for a whole run. Large early steps cover ground; small late steps settle into a minimum.\n\n**Step decay** — cut by 10× at fixed epochs. Crude and effective.\n\n**Cosine annealing** — smoothly anneal from the peak to near zero along a cosine curve. The default for large-model training.\n\n**Warmup** — start near zero and ramp up over the first few hundred steps. Essential for transformers with Adam: the optimizer\'s variance estimates are garbage at step one, and taking full-size steps on garbage estimates destabilises training immediately.\n\nThe standard modern recipe is **linear warmup then cosine decay**, and it is worth more than most architecture tweaks.',
            ),
            mcq(
              'Why do transformer training runs almost always use learning-rate warmup?',
              [
                'To save compute early on',
                'Adam\'s moment estimates are unreliable in the first steps, so full-size updates destabilise training',
                'It prevents overfitting',
                'It is required by the attention mechanism',
              ],
              1,
              ['sk-learning-rate', 'sk-optimizers'],
              'Adam divides by a running estimate of gradient magnitude. Before that estimate has stabilised the division is unreliable, producing enormous erratic steps. Warmup keeps steps small until the statistics settle.',
            ),
            concept(
              'Normalization layers',
              'Deep networks train badly when activation scales drift between layers. Normalization keeps them in check.\n\n**Batch normalization** normalizes each feature across the *batch*, then rescales with learned parameters. It accelerated convolutional networks dramatically. Its weakness is the batch dependence: small batches give noisy statistics, and train/inference behaviour differs because inference uses running averages.\n\n**Layer normalization** normalizes across the *features* of each example independently. No batch dependence, identical behaviour at train and inference, and it works with sequences of varying length — which is why every transformer uses it.\n\nModern transformers place it *before* the sublayer (**pre-norm**) rather than after. Pre-norm keeps the residual path clean and makes deep stacks trainable without delicate warmup tuning.',
            ),
            fill(
              '___ normalization computes statistics across the batch, while ___ normalization computes them across features within a single example.',
              [['batch'], ['layer']],
              ['sk-batch-norm'],
              'The batch dependence is exactly why transformers, which handle variable-length sequences and often small effective batches per device, standardised on layer norm.',
            ),
            trueFalse(
              'Batch normalization behaves identically during training and inference.',
              false,
              ['sk-batch-norm'],
              'Training uses the current batch\'s statistics; inference uses running averages accumulated during training. Forgetting to switch the model to eval mode is a classic bug that produces mysteriously bad inference results.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-transfer-learning',
          title: 'Transfer Learning',
          summary: 'Why you almost never train from scratch.',
          level: 'intermediate',
          domain: 'deep-learning',
          steps: [
            concept(
              'Standing on pretrained weights',
              'Training a large model from random initialisation needs enormous data and compute. Almost nobody does it. Instead:\n\n1. Take a model **pretrained** on a large general corpus.\n2. **Fine-tune** it on your much smaller specific dataset.\n\nThis works because early layers learn general structure — edges and textures in vision, syntax and common semantics in language — that transfers across tasks. Only the later, task-specific layers need substantial adjustment.\n\nA vision model pretrained on ImageNet can be fine-tuned for medical imaging with a few thousand labelled scans instead of a few million.',
            ),
            concept(
              'How much to fine-tune',
              '**Feature extraction** — freeze the whole backbone, train only a new head. Fastest, least data needed, and the safest choice when you have a few hundred examples.\n\n**Full fine-tuning** — update every parameter with a small learning rate. Best results when you have enough data, but expensive and risks **catastrophic forgetting** if the rate is too high.\n\n**Parameter-efficient fine-tuning (PEFT)** — freeze the base and train a small number of added parameters. **LoRA** is the dominant method: it injects low-rank matrices into the attention weights, training well under 1% of the parameters while matching full fine-tuning on many tasks. The adapter is a few megabytes, so one base model can serve hundreds of specialisations.',
              { keyTerms: [{ term: 'LoRA', definition: 'Low-Rank Adaptation — trains small injected matrices instead of full weights.' }, { term: 'Catastrophic forgetting', definition: 'Losing pretrained capability while fine-tuning on a narrow task.' }] },
            ),
            mcq(
              'You have 800 labelled images and need a domain classifier. Best approach?',
              [
                'Train a ResNet from scratch',
                'Fine-tune a pretrained model, freezing most of the backbone',
                'Use a much larger network',
                'Collect a million images first',
              ],
              1,
              ['sk-transfer-learning'],
              '800 images is far too few to train from scratch — you would overfit immediately. A pretrained backbone with a fresh head learns the task with the data you actually have.',
            ),
            mcq(
              'What is the main practical advantage of LoRA over full fine-tuning?',
              [
                'It always produces higher accuracy',
                'It trains and stores a tiny fraction of the parameters, so one base model can serve many adapters',
                'It requires no training data',
                'It makes inference faster than the base model',
              ],
              1,
              ['sk-transfer-learning'],
              'Cost and deployment are the win: megabyte-sized adapters instead of full model copies, and adapters can be swapped per request. Merged LoRA weights make inference neither faster nor slower than the base model.',
            ),
            trueFalse(
              'Fine-tuning with too high a learning rate can destroy the general capabilities the model was pretrained with.',
              true,
              ['sk-transfer-learning'],
              'That is catastrophic forgetting. Fine-tuning learning rates are typically 10–100× smaller than pretraining rates for exactly this reason.',
            ),
          ],
        }),
        lesson({
          id: 'lesson-dropout-scaling',
          title: 'Dropout, Depth, and Scale',
          summary: 'Regularizing networks, and what happens when you make them enormous.',
          level: 'expert',
          domain: 'deep-learning',
          steps: [
            concept(
              'Dropout',
              'During training, randomly zero out a fraction of the units in a layer — typically 20–50% — resampling which ones on every forward pass.\n\nIt sounds like sabotage. It works for two reasons.\n\n**It prevents co-adaptation.** A unit cannot rely on a specific partner always being present, so it must learn a feature that is useful on its own. Fragile chains of mutually-dependent units stop forming.\n\n**It approximates an ensemble.** Each forward pass trains a different thinned sub-network. At inference all units are active with outputs scaled appropriately, which approximates averaging over exponentially many networks — for the cost of one.\n\nDropout is off at inference. Forgetting to switch the model into eval mode is a classic bug: the model produces different answers to the same input every time.\n\nIt has become less central in transformers, where layer normalization, weight decay, and simply having enormous datasets do much of the same work.',
              { keyTerms: [{ term: 'Dropout rate', definition: 'Fraction of units zeroed per training pass. Typically 0.1–0.5.' }] },
            ),
            mcq(
              'A model performs well in training but produces inconsistent predictions for the same input at inference. What is the likely cause?',
              [
                'The learning rate is too high',
                'Dropout is still active — the model was not switched to evaluation mode',
                'The dataset is too small',
                'The optimizer is misconfigured',
              ],
              1,
              ['sk-dropout'],
              'Active dropout at inference randomly zeroes units each pass, so identical inputs give different outputs. Eval mode disables dropout and switches batch norm to its running statistics.',
            ),
            trueFalse(
              'Dropout is applied during both training and inference.',
              false,
              ['sk-dropout'],
              'Training only. At inference the full network is used, with activations scaled to match the expected magnitude seen during training.',
            ),
            concept(
              'CNN architectures worth knowing',
              'The lineage of convolutional networks is a compressed history of the ideas that made depth work.\n\n**LeNet-5 (1998)** — convolutions and pooling on handwritten digits. The template, twenty years early.\n\n**AlexNet (2012)** — the same ideas at scale, on GPUs, with ReLU and dropout. Won ImageNet by a wide enough margin to redirect the whole field.\n\n**VGG (2014)** — showed that stacking small 3×3 filters beats using large ones: two 3×3 layers cover the same receptive field as one 5×5 with fewer parameters and an extra nonlinearity.\n\n**ResNet (2015)** — residual connections. Made 152-layer networks trainable and is the single most influential architectural idea of the decade; transformers use the same trick.\n\n**EfficientNet (2019)** — showed that depth, width, and input resolution should be scaled together in fixed proportion rather than one at a time.\n\nThe throughline: **make gradient flow easier, and reuse parameters wherever the structure of the data permits.**',
            ),
            mcq(
              'Why does VGG stack two 3×3 convolutions instead of using one 5×5?',
              [
                'It is faster on CPUs',
                'Same receptive field with fewer parameters and an extra nonlinearity in between',
                '5×5 filters cannot be trained',
                'It reduces the number of channels',
              ],
              1,
              ['sk-cnn-architecture'],
              'Two stacked 3×3 layers see a 5×5 region using 18 weights per channel pair instead of 25, and add a nonlinearity between them — more expressive for less cost.',
            ),
            multi(
              'Which architectural ideas made very deep networks trainable? (Select all)',
              [
                'Residual (skip) connections',
                'Batch normalization',
                'ReLU activations',
                'Larger convolutional filters',
              ],
              [0, 1, 2],
              ['sk-cnn-architecture', 'sk-vanishing-gradients'],
              'The first three all address gradient flow. Filter size affects the receptive field, not trainability at depth.',
            ),
            concept(
              'Scaling laws',
              'Empirically, model performance improves as a **smooth power law** in three quantities: parameters, training data, and compute. Plot loss against any of them on log axes and you get a straight line over many orders of magnitude.\n\nThis is unusual and consequential. It means you can *predict* the performance of a model you have not yet trained, from small-scale runs — which is what makes committing tens of millions of dollars to a single training run a defensible engineering decision rather than a gamble.\n\nThe **Chinchilla** result corrected an important earlier mistake. Models had been trained far too large for their data budgets. For a fixed compute budget, parameters and training tokens should scale roughly **in proportion** — a 70B model trained on ~1.4T tokens outperforms a 280B model trained on 300B tokens using the same compute.\n\nTwo caveats that matter. Scaling laws describe *loss*, and loss improves smoothly while specific capabilities can appear more abruptly. And they say nothing about running out of high-quality text, which is a real constraint now.',
              { keyTerms: [{ term: 'Scaling law', definition: 'Power-law relationship between loss and parameters, data, or compute.' }, { term: 'Chinchilla-optimal', definition: 'Scaling parameters and training tokens in proportion for a fixed compute budget.' }] },
            ),
            mcq(
              'The Chinchilla result showed that earlier large models were:',
              [
                'Too small for their training data',
                'Undertrained — too many parameters for the number of tokens they saw',
                'Using the wrong optimizer',
                'Overfitting their training data',
              ],
              1,
              ['sk-scaling-laws'],
              'They were parameter-heavy and data-starved. Rebalancing toward more tokens per parameter produced better models at the same compute cost — and cheaper inference, since the model is smaller.',
            ),
            mcq(
              'Why are scaling laws commercially important?',
              [
                'They prove larger models are always better',
                'They let you predict a large run\'s performance from small runs, making the investment decision defensible',
                'They eliminate the need for evaluation',
                'They reduce inference cost directly',
              ],
              1,
              ['sk-scaling-laws'],
              'Predictability is the whole value. Without it, a nine-figure training run would be an unhedged bet.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-dl-2',
        title: 'Training Checkpoint',
        passingScore: 0.75,
        exercises: [
          mcq(
            'Loss becomes NaN after a few hundred steps. Most likely first fix?',
            [
              'Add more layers',
              'Lower the learning rate and add gradient clipping',
              'Increase the batch size',
              'Remove normalization layers',
            ],
            1,
            ['sk-vanishing-gradients', 'sk-learning-rate'],
            'NaN loss is the signature of exploding gradients. Smaller steps and a cap on the gradient norm are the direct remedies.',
          ),
          multi(
            'Which are true of backpropagation? (Select all)',
            [
              'It computes gradients for all parameters in one backward pass',
              'It applies the chain rule from the loss backwards',
              'It requires cached forward activations',
              'It updates the parameters directly',
            ],
            [0, 1, 2],
            ['sk-backpropagation'],
            'Backprop computes gradients; the *optimizer* applies them. Keeping those responsibilities separate is why you can swap Adam for SGD without touching the model.',
          ),
          numeric(
            'A 3-layer chain has local derivatives 0.2, 0.2, and 0.2. What is the product?',
            0.008,
            ['sk-vanishing-gradients'],
            '0.2³ = 0.008. Extend this to 50 layers and the gradient reaching the first layer is effectively zero — that is vanishing gradients in one calculation.',
            { tolerance: 0.0001 },
          ),
        ],
      },
    },

    {
      id: 'unit-dl-3',
      title: 'Convolutional Networks',
      description: 'The architecture that made computer vision work.',
      lessons: [
        lesson({
          id: 'lesson-cnns',
          title: 'Convolutions',
          summary: 'Sliding a small filter, sharing weights everywhere.',
          level: 'intermediate',
          domain: 'computer-vision',
          steps: [
            concept(
              'Why fully connected fails on images',
              'A 224×224 RGB image is 150,528 numbers. A fully connected layer to 1,000 units needs 150 million parameters — for one layer. It would overfit instantly and learn nothing reusable.\n\nWorse, it throws away everything you know about images. A cat in the top-left and the same cat in the bottom-right are completely different input vectors, so the network must learn "cat" separately for every position.\n\nConvolution fixes both by encoding two facts about images directly into the architecture: **nearby pixels are related**, and **a feature is the same feature wherever it appears**.',
              { figure: 'cnn-filters' },
            ),
            concept(
              'The convolution operation',
              'Take a small filter — say 3×3 — and slide it across the image. At each position, multiply elementwise with the pixels underneath and sum. The result is a **feature map** showing where in the image that pattern occurs.\n\nThe filter values are *learned*. Train the network and early filters converge on edge detectors, colour blobs, and gradients — which is what classical vision engineers used to design by hand.\n\nTwo properties fall out:\n\n**Parameter sharing.** One 3×3 filter is 9 weights regardless of image size, reused at every position. Compare to 150 million.\n\n**Translation equivariance.** Shift the input, and the feature map shifts identically. The network recognises a pattern anywhere without needing separate examples at every location.',
              { keyTerms: [{ term: 'Feature map', definition: 'The output of applying one filter across the whole input.' }, { term: 'Receptive field', definition: 'The region of the original input that influences one output value.' }] },
            ),
            numeric(
              'A 3×3×3 convolutional filter, plus one bias. How many parameters?',
              28,
              ['sk-convolution'],
              '3 × 3 × 3 = 27 weights (the third 3 is the RGB channel depth), plus 1 bias = 28. A layer with 64 such filters holds 1,792 parameters — several orders of magnitude below the fully connected equivalent.',
            ),
            interactive(
              'Slide a kernel over pixels',
              'convolution',
              'Pick an edge-detection, blur, or sharpen kernel and step it across the grid one position at a time, watching each output value get computed. Then design your own kernel and see what it responds to.',
            ),
            mcq(
              'What does pooling do?',
              [
                'Adds parameters to increase capacity',
                'Downsamples spatially, shrinking the map and adding local translation invariance',
                'Normalizes activations across the batch',
                'Applies the nonlinearity',
              ],
              1,
              ['sk-pooling'],
              'Max pooling takes the strongest response in each small window. That reduces spatial resolution, enlarges the receptive field of later layers, and makes the representation tolerant to small shifts. It has no learnable parameters.',
            ),
            concept(
              'The hierarchy',
              'Stack convolution and pooling and a hierarchy emerges without supervision:\n\n**Layer 1** — edges and colour gradients.\n**Layer 2** — corners, textures, simple shapes.\n**Layer 3** — object parts: eyes, wheels, letters.\n**Layer 4+** — whole objects and scenes.\n\nEach layer composes the one below, and the receptive field grows with depth until late units see essentially the whole image.\n\nThis progression was verified empirically by visualising the filters, and it matches the rough organisation of the mammalian visual cortex — one of the few places where the biological analogy holds up at all.',
            ),
            multi(
              'Genuine advantages of convolution over fully connected layers on images? (Select all)',
              [
                'Far fewer parameters through weight sharing',
                'Translation equivariance',
                'Exploits the fact that nearby pixels are related',
                'Guaranteed rotation invariance',
              ],
              [0, 1, 2],
              ['sk-convolution'],
              'The first three are structural properties of convolution. Rotation invariance is *not* one of them — CNNs handle rotation poorly unless you add rotated examples through data augmentation.',
            ),
            trueFalse(
              'Vision transformers have made CNNs obsolete.',
              false,
              ['sk-vision-transformers'],
              'ViTs win at very large data scale, where their weaker inductive bias becomes an advantage. CNNs remain strong on smaller datasets — precisely *because* their built-in assumptions about locality and translation mean less has to be learned. Hybrid architectures are common.',
            ),
          ],
        }),
      ],
    },
  ],
};
