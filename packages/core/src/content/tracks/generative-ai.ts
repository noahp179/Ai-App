/** Track 6 — Generative AI Beyond Text. Intermediate → expert. */

import type { Track } from '../../domain/types.js';
import { concept, lesson, match, mcq, multi, order, shortAnswer, trueFalse } from '../builders.js';

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
  ],
};
