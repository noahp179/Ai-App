/** Track 6 — Generative AI Beyond Text. Intermediate → expert. */

import type { Track } from '../../domain/types';
import { concept, interactive, lesson, match, mcq, multi, numeric, order, shortAnswer, trueFalse } from '../builders';

export const generativeAiTrack: Track = {
  id: 'track-generative-ai',
  title: 'Generative AI Beyond Text',
  tagline: 'Images, audio, video, and multimodal models',
  description:
    'How diffusion models turn noise into pictures, what GANs and VAEs were for, and how a single model comes to understand images and text in the same space.',
  domain: 'generative-ai',
  level: 'intermediate',
  icon: '🎨',
  gradient: ['#EC4899', '#F43F5E'],
  prerequisites: ['track-deep-learning'],
  outcomes: [
    'Explain the difference between generative and discriminative models',
    'Describe the diffusion process forwards and backwards',
    'Explain how text conditions image generation',
    'Reason about deepfakes, provenance, and creative rights',
    'Explain what a latent space is and why a VAE can sample from one',
    'Say why diffusion displaced GANs despite comparable sample quality',
    'Predict what guidance, seeds, and step count will change',
  ],
  units: [
    {
      id: 'unit-gen-1',
      title: 'Generating Things',
      description: 'The three architectures that made generation work.',
      lessons: [
        lesson({
          id: 'lesson-generative-vs-discriminative',
          title: 'Generative vs Discriminative',
          summary: 'Drawing the boundary versus modelling the thing.',
          level: 'intermediate',
          domain: 'generative-ai',
          free: true,
          steps: [
            concept(
              'Two ways to model data',
              'A **discriminative** model learns the boundary between classes — `P(label | data)`. Given this photo, is it a cat or a dog? It never needs to know what a cat *looks like* in general, only what separates cats from dogs in the data it saw.\n\nA **generative** model learns the distribution of the data itself — `P(data)`, or `P(data | label)`. Given "cat", it can produce a new image of a cat that has never existed.\n\nThe generative task is strictly harder. Distinguishing cats from dogs might come down to ear shape; generating a convincing cat requires modelling fur, anatomy, lighting, pose, and background coherence all at once.\n\nWhich is why generative models were the laggards for decades, and why their sudden competence changed the field.',
              { keyTerms: [{ term: 'Discriminative', definition: 'Models P(label | data) — the decision boundary.' }, { term: 'Generative', definition: 'Models P(data) — the distribution itself, so it can sample new examples.' }] },
            ),
            match(
              'Classify each model.',
              [
                { left: 'Spam classifier', right: 'Discriminative' },
                { left: 'Image generator from a text prompt', right: 'Generative' },
                { left: 'Large language model', right: 'Generative' },
                { left: 'Credit-default predictor', right: 'Discriminative' },
              ],
              ['sk-generative-vs-discriminative'],
              'If it produces new samples from the data distribution, it is generative. An LLM qualifies — it models the distribution over token sequences.',
            ),
            concept(
              'GANs: two networks in a duel',
              'A **generative adversarial network** trains two models against each other.\n\nThe **generator** turns random noise into a fake image. The **discriminator** tries to tell fakes from real training images. Each improves by defeating the other, and at equilibrium the generator produces samples the discriminator cannot distinguish from real data.\n\nGANs dominated image generation from 2014 to roughly 2021 and produced the first genuinely photorealistic synthetic faces. They are also notoriously hard to train:\n\n**Mode collapse** — the generator finds a handful of outputs that fool the discriminator and produces only those, losing all diversity.\n\n**Training instability** — the two networks must improve at comparable rates. Let either win decisively and learning stops.\n\nDiffusion models displaced them largely because they train stably with a simple regression loss.',
            ),
            mcq(
              'A GAN generator produces only three nearly identical faces regardless of input noise. What is this?',
              ['Overfitting', 'Mode collapse', 'Vanishing gradients', 'Data leakage'],
              1,
              ['sk-gan'],
              'Mode collapse: the generator has found a small set of outputs that reliably fool the discriminator and has stopped covering the rest of the distribution. Diversity is lost even though sample quality may look fine.',
            ),
            concept(
              'Autoencoders and VAEs',
              'An **autoencoder** squeezes input through a narrow bottleneck and reconstructs it. The encoder compresses to a **latent** vector; the decoder rebuilds. Since the bottleneck cannot hold everything, the network must learn what actually matters.\n\nA plain autoencoder is not generative — its latent space has gaps, so a randomly chosen point usually decodes to nothing coherent.\n\nA **variational autoencoder** fixes this by encoding to a *distribution* rather than a point, and adding a term to the loss that pulls the latent space toward a standard normal. That makes the space continuous and samplable: pick any point, get a plausible output, and interpolate smoothly between two encodings.\n\nVAEs alone produce blurry images. But they turned out to be a critical component of modern diffusion systems — the "latent" in Stable Diffusion is a VAE latent, and running diffusion in that compressed space instead of at full pixel resolution is what made it fast enough to run on consumer hardware.',
            ),
            mcq(
              'What does the VAE\'s extra loss term accomplish?',
              [
                'Faster training',
                'A continuous, samplable latent space you can draw new points from',
                'Higher-resolution output',
                'Smaller model size',
              ],
              1,
              ['sk-vae'],
              'Regularising the latent toward a known distribution removes the dead zones a plain autoencoder leaves, which is exactly what makes sampling and interpolation work.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-diffusion',
          title: 'Diffusion Models',
          summary: 'Learn to remove noise, then remove it from pure noise.',
          level: 'expert',
          domain: 'generative-ai',
          steps: [
            concept(
              'Destroy, then learn to undo',
              'The idea is almost perverse, and it works better than anything before it.\n\n**Forward process.** Take a real image and add a small amount of Gaussian noise. Repeat, say, a thousand times. The end state is indistinguishable from pure static. This requires no learning at all — it is a fixed schedule.\n\n**Reverse process.** Train a network to undo one step: given a noisy image and the timestep, predict the noise that was added. This is straightforward supervised regression, because you generated the noise yourself and know the exact answer.\n\n**Generation.** Start from pure random noise and run the learned denoiser repeatedly. After enough steps, an image emerges.\n\nWhy this beats GANs: the training objective is a simple, stable regression loss with no adversarial dynamics, no mode collapse, and no delicate balancing act. It just needs many steps at generation time — which is why samplers that get good results in 20 steps instead of 1,000 were such an important advance.',
              {
                figure: 'diffusion-steps',
                keyTerms: [
                  { term: 'Forward diffusion', definition: 'Fixed schedule of progressively adding noise. No learning involved.' },
                  { term: 'Reverse diffusion', definition: 'The learned denoising process that generates samples.' },
                ],
              },
            ),
            order(
              'Order how a diffusion model generates an image.',
              [
                'Start from a tensor of pure random noise',
                'Predict the noise present at the current timestep',
                'Subtract the predicted noise to get a slightly cleaner image',
                'Repeat for the remaining timesteps until an image emerges',
              ],
              ['sk-diffusion'],
              'Each step removes a little noise. The image does not appear all at once — it resolves gradually out of static.',
            ),
            interactive(
              'Denoise step by step',
              'diffusion-denoise',
              'Drag the timestep from pure noise to finished image and watch structure resolve. Then reduce the step count and see quality degrade — the reason fast samplers were such an important advance.',
            ),
            mcq(
              'What does the network actually predict during diffusion training?',
              [
                'The final clean image directly',
                'The noise that was added at this timestep',
                'The class label',
                'The next pixel',
              ],
              1,
              ['sk-diffusion'],
              'Predicting the noise (the ε-prediction objective) proved far more stable than predicting the clean image. The clean image is recoverable by subtraction anyway.',
            ),
            concept(
              'How text steers the image',
              'A raw diffusion model generates *some* image from the training distribution. Getting a *specific* one requires conditioning.\n\n1. A text encoder — usually CLIP-derived — turns the prompt into embeddings.\n2. Those embeddings enter the denoising U-Net through **cross-attention** layers at every step, so the text influences every stage of the resolve.\n3. **Classifier-free guidance** runs the denoiser twice, once with the prompt and once without, and extrapolates away from the unconditional prediction. The guidance scale controls how hard it pushes.\n\nGuidance scale is the knob users feel most directly. Low values give creative, loosely-related images. High values follow the prompt tightly but become oversaturated and lose coherence. Around 7 is the usual sweet spot.',
            ),
            mcq(
              'A user sets guidance scale to 25 and gets oversaturated, distorted images. Why?',
              [
                'The model is broken',
                'Extreme guidance over-amplifies the conditional direction, pushing samples off the natural image manifold',
                'The prompt was too short',
                'Too few denoising steps',
              ],
              1,
              ['sk-text-to-image'],
              'Guidance extrapolates away from the unconditional prediction. Push too far and you leave the region where the model produces realistic images — prompt adherence rises while realism collapses.',
            ),
            concept(
              'Multimodal models and CLIP',
              '**CLIP** trains an image encoder and a text encoder *jointly*, on hundreds of millions of image-caption pairs, with a contrastive objective: matching pairs should have high cosine similarity, mismatched pairs low.\n\nThe result is a **shared embedding space** where a photo of a dog and the string "a photo of a dog" land near each other. That single property enables a great deal:\n\n- **Zero-shot classification** — embed the image, embed candidate labels, pick the nearest. No task-specific training.\n- **Semantic image search** in natural language.\n- **Text conditioning** for generation, which is what diffusion models use it for.\n\nModern multimodal LLMs go further, projecting image patches directly into the language model\'s token space so images and text flow through one shared stack. Same underlying idea: **get everything into one space and the model can relate across modalities.**',
            ),
            shortAnswer(
              'Why does a shared image-text embedding space enable zero-shot classification?',
              ['same space', 'similarity', 'compare', 'labels', 'embed'],
              'Images and text land in the same space, so you can embed the image and embed candidate label strings and compare them directly with cosine similarity. The nearest label wins, with no classifier trained for those specific classes.',
              ['sk-clip-multimodal'],
              'A shared space turns classification into a nearest-neighbour lookup, which means new classes require only new label text — no retraining.',
            ),
            multi(
              'Which are true of diffusion models compared to GANs? (Select all)',
              [
                'Training is more stable',
                'They avoid mode collapse',
                'Generation requires many sequential steps',
                'They need less compute at generation time',
              ],
              [0, 1, 2],
              ['sk-diffusion', 'sk-gan'],
              'Stability and diversity are diffusion\'s advantages; the iterative sampling is its cost. A GAN generates in a single forward pass, which is still much faster per sample.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-genai-society',
          title: 'Deepfakes and Provenance',
          summary: 'What happens when synthetic media is free.',
          level: 'intermediate',
          domain: 'ethics-safety',
          steps: [
            concept(
              'The cost of fabrication went to zero',
              'Convincing fake images, audio, and video used to require a studio. Now they require a prompt.\n\nDocumented harms, in rough order of measured prevalence:\n\n- **Non-consensual intimate imagery**, overwhelmingly targeting women. This is by a wide margin the most common malicious use of the technology.\n- **Voice-cloning fraud**, including impersonating relatives in distress and executives authorising transfers. Cloning needs seconds of audio.\n- **Political disinformation**, particularly around elections.\n- **The liar\'s dividend** — the subtler harm. Once anything *could* be fake, genuine evidence becomes deniable. The mere existence of the technology degrades trust in real recordings.',
            ),
            concept(
              'Detection is losing; provenance might not',
              'Detecting synthetic media is a losing game. Detectors train on known generators and fail on new ones, and any published detector becomes a training signal for the next generation.\n\n**Provenance** inverts the problem: instead of proving something is fake, cryptographically attest what is real.\n\n**C2PA / Content Credentials** — a signed manifest attached at capture and updated through each edit, recording device, time, and modifications. Supported by camera manufacturers and major editing tools.\n\n**Watermarking** — imperceptible signals embedded during generation, such as SynthID. Robust to mild transformation, though not to a determined adversary.\n\nNeither is complete. Metadata is stripped by every social platform on upload, and watermarks can be removed. But provenance at least fails in the safer direction: an absent credential means "unverified" rather than "fake", which is an honest thing to say.',
            ),
            mcq(
              'Why is provenance a more promising approach than detection?',
              [
                'Detection is computationally expensive',
                'Detectors fail on unseen generators, while cryptographic attestation of real content does not depend on recognising the generator',
                'Provenance is legally required',
                'Detection only works on images',
              ],
              1,
              ['sk-responsible-deployment'],
              'Detection is an arms race against every future model. Provenance makes a positive claim about known-real content, which does not degrade as generators improve.',
            ),
            multi(
              'Which are real limitations of current provenance systems? (Select all)',
              [
                'Social platforms often strip metadata on upload',
                'Absence of a credential does not prove content is synthetic',
                'Watermarks can be removed by a determined adversary',
                'They require the viewer to run a detection model',
              ],
              [0, 1, 2],
              ['sk-responsible-deployment'],
              'Stripping, ambiguous absence, and removability are all genuine gaps. Verification is a signature check, not a detection model — which is precisely the advantage.',
            ),
            trueFalse(
              'A reliable universal deepfake detector is achievable with enough training data.',
              false,
              ['sk-responsible-deployment'],
              'Any detector defines a target for the next generator to evade, and the space of possible generators is open-ended. Detection is useful as one signal among several, not as a solution.',
            ),
          ],
        }),
      ],
      checkpoint: {
        id: 'checkpoint-gen-1',
        title: 'Generative Checkpoint',
        passingScore: 0.7,
        exercises: [
          mcq(
            'Which describes the diffusion training objective?',
            [
              'Fool a discriminator network',
              'Predict the noise added at a given timestep',
              'Reconstruct the input through a bottleneck',
              'Predict the next pixel',
            ],
            1,
            ['sk-diffusion'],
            'Noise prediction is a plain regression target — no adversary, which is the source of diffusion\'s training stability.',
          ),
          trueFalse(
            'A plain autoencoder can generate realistic new samples from random latent points.',
            false,
            ['sk-vae'],
            'Its latent space has gaps, so random points usually decode to nothing coherent. The VAE\'s regularisation term is what fixes this.',
          ),
        ],
      },
    },
    // -----------------------------------------------------------------------
    {
      id: 'unit-gen-2',
      title: 'Latent Space',
      description: 'Compress to a code, then generate from it.',
      lessons: [
        lesson({
          id: 'lesson-autoencoders',
          title: 'Autoencoders and VAEs',
          summary: 'Squeeze an image through a bottleneck and something useful happens.',
          level: 'intermediate',
          domain: 'generative-ai',
          steps: [
            concept(
              'The bottleneck does the work',
              'An **autoencoder** is two networks bolted together. The **encoder** compresses an input into a small vector; the **decoder** tries to rebuild the original from that vector alone. Train it to minimise reconstruction error and you are, on the face of it, teaching a network to copy its input — a pointless objective.\n\nExcept for the bottleneck. If the code is 64 numbers and the image is 65,536 pixels, copying is impossible. The only way to reconstruct well is to **discover what actually varies in the data** and spend the 64 numbers on that. Pose, lighting, identity — the factors that matter — rather than per-pixel noise.\n\nThe code is called the **latent vector** and the space it lives in is the **latent space**. This is the same idea as embeddings, arrived at from a different direction: a compressed representation where distance means something.\n\nPlain autoencoders are excellent at compression, denoising, and anomaly detection — reconstruct a fraud transaction with a model trained only on normal ones and the error spikes. What they are bad at is **generation**, and understanding why is the point of the next section.',
              {
                keyTerms: [
                  { term: 'Latent vector', definition: 'The compressed code an encoder produces. Its dimensions are learned factors of variation.' },
                  { term: 'Reconstruction error', definition: 'How far the decoded output is from the original input.' },
                ],
              },
            ),
            mcq(
              'Why does a bottleneck force an autoencoder to learn something useful?',
              [
                'It makes training faster',
                'The code is too small to copy the input, so the network must encode only what varies meaningfully',
                'It prevents the gradients from vanishing',
                'It adds noise that acts as regularization',
              ],
              1,
              ['sk-latent-space'],
              'Capacity is the constraint that creates the learning. Remove the bottleneck — make the code as large as the input — and the network learns the identity function, which is perfectly accurate and tells you nothing.',
            ),
            concept(
              'Why a plain autoencoder cannot generate',
              'The obvious next step is to pick a random latent vector, decode it, and get a new face. It does not work, and the reason is instructive.\n\nA plain autoencoder is only trained to decode the specific codes its encoder produced. Those codes cluster in isolated islands with **arbitrary gaps between them**. Sample a point in a gap and the decoder has never seen anything like it — you get noise. Interpolate between two faces and you pass through that same unmapped territory, producing a blurry mess rather than a plausible in-between face.\n\nA **variational autoencoder** fixes this by changing what the encoder outputs. Instead of a single point it produces a **distribution** — a mean and a variance — and the latent is sampled from it. Two terms in the loss then fight each other productively: reconstruction error pulls codes apart so they stay distinguishable, while a **KL divergence** term pulls the whole cloud toward a standard normal distribution.\n\nThe result is a latent space that is *continuous and densely covered*. Sampling from a standard normal now lands somewhere the decoder understands, and interpolation passes through valid faces the whole way.\n\nThe cost is the trade everyone notices: VAE samples are blurrier than GAN or diffusion samples, because averaging over a distribution smooths detail. Which is why modern image generators use a VAE not as the generator but as the **compressor** — Stable Diffusion runs its diffusion process in a VAE latent space, roughly 48× smaller than pixels, and that is most of why it runs on a consumer GPU.',
              {
                keyTerms: [
                  { term: 'VAE', definition: 'An autoencoder whose encoder outputs a distribution, regularised toward a standard normal.' },
                  { term: 'KL divergence', definition: 'A measure of how far one distribution is from another. Here, the regulariser that makes the latent space continuous.' },
                ],
              },
            ),
            mcq(
              'What does the KL term in a VAE’s loss actually buy you?',
              [
                'Sharper reconstructions',
                'A latent space with no gaps, so random samples and interpolations decode to plausible outputs',
                'Faster convergence',
                'Smaller model size',
              ],
              1,
              ['sk-vae'],
              'It shapes the latent distribution to match a standard normal, filling in the gaps a plain autoencoder leaves. It actively costs you sharpness — that is the trade — but without it you cannot sample at all.',
            ),
            match(
              'Match each model to what it is best at.',
              [
                { left: 'Detecting transactions unlike anything in training', right: 'Plain autoencoder' },
                { left: 'Sampling new faces from random noise', right: 'VAE' },
                { left: 'Compressing images so diffusion can run cheaply', right: 'VAE encoder' },
                { left: 'Removing sensor noise from a signal', right: 'Denoising autoencoder' },
              ],
              ['sk-vae', 'sk-latent-space'],
              'The compression role is the one that actually ships at scale — nearly every latent diffusion model has a VAE doing exactly that job.',
            ),
            trueFalse(
              'Interpolating between two latent vectors in a well-trained VAE produces a smooth sequence of plausible outputs.',
              true,
              ['sk-latent-space'],
              'That is the property the KL term is there to create. The same interpolation in a plain autoencoder crosses unmapped regions and degenerates into noise part-way.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-gans',
          title: 'GANs and Adversarial Training',
          summary: 'Two networks in a contest — brilliant output, miserable training.',
          level: 'expert',
          domain: 'generative-ai',
          steps: [
            concept(
              'A forger and a detective',
              'A **generative adversarial network** is a game between two networks.\n\nThe **generator** turns random noise into a fake image. The **discriminator** is shown a mix of real and fake images and has to say which is which. The discriminator trains to classify correctly; the generator trains to make the discriminator wrong.\n\nNeither is told what a good image looks like. There is no reconstruction loss, no target to match. **The generator\'s only feedback is another network\'s opinion**, and that opinion gets sharper as it trains — so the bar rises continuously. At the theoretical optimum the generator matches the data distribution and the discriminator is reduced to guessing at 50%.\n\nThat design is why GAN output was, for years, dramatically sharper than anything else. A reconstruction loss averages over possibilities and produces blur. A discriminator does not average — it says *this specific image looks wrong*, and blurry images look very wrong indeed.',
              { keyTerms: [{ term: 'Adversarial training', definition: 'Two networks optimising opposing objectives, each improving because the other does.' }] },
            ),
            mcq(
              'Why is GAN output typically sharper than a VAE’s?',
              [
                'GANs use more parameters',
                'A discriminator penalises implausible-looking images; a reconstruction loss averages over possibilities and produces blur',
                'GANs train on higher-resolution data',
                'VAEs cannot use convolutions',
              ],
              1,
              ['sk-gan', 'sk-vae'],
              'Averaging is what produces blur. Faced with several plausible completions, a pixel-wise loss splits the difference and gets a smear; a discriminator rejects the smear outright because no real image looks like it.',
            ),
            concept(
              'Why GANs are so hard to train',
              'The elegance has a price, and it is steep.\n\n**Mode collapse.** The generator finds one output that fools the discriminator and produces variations of it forever. Ask for a thousand faces, get a thousand near-identical faces. The loss looks fine — it genuinely is fooling the discriminator — while diversity has quietly gone to zero.\n\n**Non-convergence.** The two losses are coupled, so neither going down means progress. A falling generator loss might mean it improved, or it might mean the discriminator got worse. **You cannot read a GAN\'s training curve the way you read a normal one**, which removes the main instrument you use to tell whether training is working.\n\n**Imbalance.** If the discriminator gets too good too fast it rejects everything with near-total confidence, the gradient it passes back vanishes, and the generator stops learning. Too weak and it provides no useful signal. The balance has to be maintained throughout.\n\nA decade of fixes followed — Wasserstein loss, gradient penalties, spectral normalisation, progressive growing — and they help. But the honest summary is that GANs were displaced for image generation not because they produced worse images but because **diffusion models train with a stable, readable loss**. A method that reliably works beats a method that sometimes works better.',
            ),
            mcq(
              'A GAN’s generator loss is falling steadily. What can you conclude?',
              [
                'The generated images are getting better',
                'Very little — the loss is relative to a discriminator that is also changing',
                'Training has converged',
                'The discriminator has collapsed',
              ],
              1,
              ['sk-gan'],
              'Both losses are defined against a moving opponent, so neither is an absolute measure of quality. GAN progress has to be judged by looking at samples, or by a separate metric like FID computed against real data.',
            ),
            multi(
              'Which are genuine GAN failure modes? (Select all)',
              [
                'Mode collapse: the generator produces near-identical outputs',
                'Vanishing generator gradients when the discriminator becomes too strong',
                'The generator memorising the training set and overfitting the reconstruction loss',
                'Training oscillating indefinitely without converging',
              ],
              [0, 1, 3],
              ['sk-gan'],
              'The third is not a GAN failure — there is no reconstruction loss in a GAN at all. That absence is exactly what gives GANs their sharpness and costs them their stability.',
            ),
            shortAnswer(
              'Why did diffusion models largely displace GANs for image generation despite GANs producing excellent samples?',
              ['stable', 'training', 'loss', 'diversity', 'mode collapse', 'reliable'],
              'Diffusion models train with a simple, stable denoising objective whose loss actually reflects progress, and they cover the data distribution rather than collapsing onto a few modes. GANs can match or beat them on sample quality but need careful balancing to train at all, and their loss curves cannot tell you whether it is working.',
              ['sk-gan', 'sk-diffusion'],
              'The lesson generalises well beyond GANs: in practice, a method that trains reliably usually wins over one with a higher ceiling and a worse floor.',
            ),
          ],
        }),
      ],
    },

    // -----------------------------------------------------------------------
    {
      id: 'unit-gen-3',
      title: 'More Than One Modality',
      description: 'Putting images and text in the same space, and steering what comes out.',
      lessons: [
        lesson({
          id: 'lesson-clip',
          title: 'CLIP and Shared Embedding Spaces',
          summary: 'Train on 400 million captions and pictures start landing next to their descriptions.',
          level: 'expert',
          domain: 'generative-ai',
          steps: [
            concept(
              'One space, two encoders',
              '**CLIP** trains two encoders at once — one for images, one for text — with a single objective: *put an image and its real caption close together, and everything else far apart.*\n\nThe training signal is free. Scrape hundreds of millions of image–caption pairs from the web; no human ever labels a class. Each batch gives you N correct pairings and N² − N incorrect ones, and the **contrastive loss** pushes them apart. That is the whole idea.\n\nWhat falls out is a **shared embedding space** where a photo of a dog and the string "a photo of a dog" land near each other. Once you have that, several things become possible that previously needed dedicated models:\n\n- **Zero-shot classification.** Embed the image, embed `"a photo of a {label}"` for every candidate label, take the nearest. New classes cost a string, not a retraining run.\n- **Semantic image search.** Embed the query text, find the nearest image vectors.\n- **Conditioning generators.** Text-to-image models use CLIP-style text embeddings as the signal that tells the generator what to draw.\n\nThe limitations are worth knowing too: CLIP inherits the biases and the noise of web captions, it is weak on counting and spatial relations ("three cats to the left of a box"), and it can be fooled by text written inside the image — photograph an apple with a label reading "iPod" and it may well say iPod.',
              {
                keyTerms: [
                  { term: 'Contrastive learning', definition: 'Training by pulling matched pairs together and pushing mismatched pairs apart.' },
                  { term: 'Zero-shot classification', definition: 'Classifying into categories the model was never explicitly trained on.' },
                ],
              },
            ),
            mcq(
              'How does CLIP classify an image into a category it was never trained on?',
              [
                'It fine-tunes on a few examples of the new category',
                'It embeds candidate label sentences and returns whichever is nearest the image embedding',
                'It searches the training set for a similar image',
                'It uses a separate classifier head per category',
              ],
              1,
              ['sk-clip-multimodal'],
              'Both modalities live in one space, so a label becomes a point in that space just like an image does. Classification reduces to nearest-neighbour — and adding a category costs you one sentence, not a training run.',
            ),
            interactive(
              'Move through a shared space',
              'embedding-space',
              'Drag a point and watch which neighbours it acquires. A multimodal space works the same way, except the neighbours can be images or text — which is precisely what makes search across modalities possible.',
            ),
            multi(
              'Which are real weaknesses of CLIP-style models? (Select all)',
              [
                'Poor at counting objects and at spatial relations',
                'Inherits biases present in web captions',
                'Cannot be used without labelled training data',
                'Can be misled by text rendered inside the image',
              ],
              [0, 1, 3],
              ['sk-clip-multimodal'],
              'The third is backwards — needing no labelled data is CLIP\'s defining advantage. The other three are well-documented failures, and the typographic attack in the last one is a genuinely striking demonstration of how shallow the grounding can be.',
            ),
            trueFalse(
              'CLIP requires a human-labelled dataset of images and categories.',
              false,
              ['sk-clip-multimodal'],
              'It trains on image–caption pairs harvested from the web. The caption someone already wrote is the supervision, which is what let the training set reach hundreds of millions of pairs.',
            ),
          ],
        }),

        lesson({
          id: 'lesson-text-to-image',
          title: 'Text to Image in Practice',
          summary: 'How the prompt actually steers the noise — and what the knobs do.',
          level: 'intermediate',
          domain: 'generative-ai',
          steps: [
            concept(
              'Four pieces, assembled',
              'A modern text-to-image system is four components, and knowing which is which makes the failure modes legible.\n\n1. **A text encoder** turns the prompt into embeddings — usually CLIP-style, sometimes a full language model.\n2. **A VAE encoder/decoder** moves between pixels and a much smaller latent space. Diffusion runs in the latent, which is roughly 48× cheaper than running it in pixels.\n3. **A denoising network** (a U-Net or a transformer) predicts the noise to remove at each step, *conditioned on the text embedding* through cross-attention.\n4. **A scheduler** decides how many steps to take and how much noise to remove at each one.\n\nGeneration starts from pure random noise in latent space and runs the denoiser 20–50 times, each pass conditioned on the prompt, each one removing a little more noise. The VAE decoder turns the final latent into pixels.\n\nThe conditioning is the part worth dwelling on: **the prompt does not describe a target image, it biases every denoising step.** That is why prompts influence composition and style so pervasively, and why a single word can change an entire image rather than one region of it.',
              { figure: 'diffusion-steps' },
            ),
            interactive(
              'Run the denoiser',
              'diffusion-denoise',
              'Step from pure noise to a finished image one pass at a time. Notice that the early steps decide composition and the late ones decide detail — which is why prompt changes that affect layout have to be there from the start.',
            ),
            concept(
              'Guidance: how hard to push',
              '**Classifier-free guidance** is the main quality knob, and it works by running the denoiser twice per step — once with the prompt, once without — and then extrapolating *away* from the unconditioned prediction:\n\n`prediction = uncond + scale × (cond − uncond)`\n\nAt `scale = 1` you get the plain conditional model. Raise it and you amplify whatever the prompt contributed, pushing the image further toward the text and away from the model\'s generic tendencies.\n\nThe trade is sharp and visible. **Too low** (1–3) and the image ignores parts of the prompt and looks washed out. **Around 7–8** is the usual sweet spot for photographic models. **Too high** (15+) and images become oversaturated, high-contrast and weirdly rigid — the model is being pushed so far from its natural distribution that it exits the region of plausible images.\n\nThe other knobs are simpler. **Steps** trade compute for detail with sharply diminishing returns past ~30. **Seed** fixes the starting noise, which is what makes a generation reproducible — same seed, same prompt, same settings, same image. **Negative prompts** replace the empty unconditioned input with something you want to move away from, which is why "blurry, watermark" in a negative prompt does real work rather than being superstition.',
              {
                keyTerms: [
                  { term: 'Classifier-free guidance', definition: 'Extrapolating away from the unconditioned prediction to strengthen the prompt’s influence.' },
                  { term: 'Seed', definition: 'The random initial noise. Fixing it makes a generation reproducible.' },
                ],
              },
            ),
            mcq(
              'Images come out oversaturated, over-contrasted, and rigid. Which setting is the likely cause?',
              [
                'Too few denoising steps',
                'Guidance scale set far too high',
                'The seed is fixed',
                'The VAE decoder is mismatched',
              ],
              1,
              ['sk-guidance'],
              'High guidance extrapolates aggressively away from the unconditional prediction, which pushes the sample outside the distribution of real images. The signature is exactly this: blown-out colour, crushed contrast, and a strangely posed stiffness.',
            ),
            numeric(
              'Classifier-free guidance requires how many forward passes of the denoising network per step?',
              2,
              ['sk-guidance'],
              'Two — one conditioned on the prompt and one unconditioned — which is why enabling guidance roughly doubles generation cost. Some implementations batch the pair together, but the compute is still 2×.',
            ),
            match(
              'Match each knob to what it controls.',
              [
                { left: 'How strongly the prompt overrides the model’s defaults', right: 'Guidance scale' },
                { left: 'Reproducibility of a generation', right: 'Seed' },
                { left: 'Detail versus generation time', right: 'Number of steps' },
                { left: 'What the image should move away from', right: 'Negative prompt' },
              ],
              ['sk-text-to-image', 'sk-guidance'],
              'Fixing the seed and varying one knob at a time is the only way to tell what a change actually did — otherwise you are comparing two different random draws.',
            ),
          ],
        }),
      ],
    },
  ],
};
