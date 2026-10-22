import { shuffle } from './rng';

export interface TriviaQuestion {
  q: string;
  options: string[]; // first option is the correct one; shuffled when played
  explain: string;
  topic: 'ai-history' | 'ml-concepts' | 'computing';
}

export const TRIVIA: TriviaQuestion[] = [
  { topic: 'ai-history', q: 'Who proposed the “imitation game” as a test of machine intelligence in 1950?', options: ['Alan Turing', 'John von Neumann', 'Claude Shannon', 'Marvin Minsky'], explain: 'Alan Turing described it in his 1950 paper “Computing Machinery and Intelligence”.' },
  { topic: 'ai-history', q: 'The term “artificial intelligence” was coined for a 1956 summer workshop at which institution?', options: ['Dartmouth College', 'MIT', 'Stanford University', 'Bell Labs'], explain: 'John McCarthy and colleagues proposed the Dartmouth Summer Research Project on Artificial Intelligence.' },
  { topic: 'ai-history', q: 'Which IBM system defeated world chess champion Garry Kasparov in a 1997 match?', options: ['Deep Blue', 'Watson', 'Deep Thought', 'AlphaZero'], explain: 'Deep Blue won the 1997 six-game rematch.' },
  { topic: 'ai-history', q: 'AlphaGo, which beat Lee Sedol at Go in 2016, was built by which lab?', options: ['DeepMind', 'OpenAI', 'IBM Research', 'Microsoft Research'], explain: 'AlphaGo was developed by DeepMind, then part of Google.' },
  { topic: 'ai-history', q: 'ELIZA, created in the mid-1960s, was an early example of what?', options: ['A chatbot', 'A chess engine', 'A self-driving car', 'An image classifier'], explain: 'Joseph Weizenbaum’s ELIZA simulated conversation with simple pattern matching.' },
  { topic: 'ai-history', q: 'Who introduced the perceptron, an early neural network model, in the late 1950s?', options: ['Frank Rosenblatt', 'Geoffrey Hinton', 'Yann LeCun', 'Norbert Wiener'], explain: 'Frank Rosenblatt described the perceptron in 1958.' },
  { topic: 'ai-history', q: 'Which 2017 paper introduced the Transformer architecture?', options: ['Attention Is All You Need', 'ImageNet Classification with Deep CNNs', 'Playing Atari with Deep RL', 'Learning Representations by Back-propagating Errors'], explain: 'Vaswani et al. (2017) introduced the Transformer, the basis of most large language models.' },
  { topic: 'ai-history', q: 'In which year did the AlexNet result dramatically improve ImageNet image classification?', options: ['2012', '2006', '2016', '1998'], explain: 'AlexNet won the ImageNet challenge in 2012 by a large margin using GPUs.' },
  { topic: 'ai-history', q: 'ImageNet is best known as…', options: ['A large labelled image dataset', 'A neural network architecture', 'A programming language', 'A search engine'], explain: 'ImageNet’s millions of labelled images became a standard benchmark.' },
  { topic: 'ai-history', q: 'Who is often credited as the first computer programmer for her notes on the Analytical Engine?', options: ['Ada Lovelace', 'Grace Hopper', 'Margaret Hamilton', 'Hedy Lamarr'], explain: 'Ada Lovelace published an algorithm for Babbage’s Analytical Engine in 1843.' },
  { topic: 'ml-concepts', q: 'What does “overfitting” mean?', options: ['The model fits training data too closely and generalises poorly', 'The model is too small to learn anything', 'Training takes too long', 'The dataset has too many labels'], explain: 'An overfit model memorises noise in the training data and does worse on new data.' },
  { topic: 'ml-concepts', q: 'Which algorithm computes gradients layer by layer to train neural networks?', options: ['Backpropagation', 'k-means', 'Dijkstra’s algorithm', 'Quicksort'], explain: 'Backpropagation applies the chain rule to find each weight’s contribution to the error.' },
  { topic: 'ml-concepts', q: 'What does “LLM” stand for?', options: ['Large language model', 'Linear learning machine', 'Layered logic module', 'Long-term learning memory'], explain: 'Large language models are trained on large amounts of text to predict tokens.' },
  { topic: 'ml-concepts', q: 'In supervised learning, the training data contains…', options: ['Inputs paired with the correct outputs', 'Only inputs, no answers', 'Only rewards', 'Only images'], explain: 'Labels let the model learn a mapping from inputs to outputs.' },
  { topic: 'ml-concepts', q: 'For a language model, a “token” is…', options: ['A chunk of text such as a word or word piece', 'A password', 'A GPU core', 'A training epoch'], explain: 'Text is split into tokens before the model processes it.' },
  { topic: 'ml-concepts', q: 'Which of these is an unsupervised learning technique?', options: ['k-means clustering', 'Linear regression on labelled data', 'Logistic regression', 'A labelled image classifier'], explain: 'k-means groups unlabelled data points by similarity.' },
  { topic: 'ml-concepts', q: 'What does “ReLU” stand for?', options: ['Rectified linear unit', 'Recurrent learning unit', 'Regularised loss unit', 'Random elementary logic unit'], explain: 'ReLU outputs max(0, x) and is a common activation function.' },
  { topic: 'ml-concepts', q: 'In generative AI, a “hallucination” is…', options: ['Confident output that is false or unsupported', 'A model crash', 'A visual glitch on screen', 'Random noise added during training'], explain: 'Models can produce fluent text that is not grounded in facts — always verify important claims.' },
  { topic: 'ml-concepts', q: 'What is a validation set used for?', options: ['Checking performance on data not used for fitting, to tune choices', 'Storing the final model', 'Speeding up training', 'Labelling new data'], explain: 'It helps choose settings and detect overfitting before the final test.' },
  { topic: 'ml-concepts', q: 'What is “prompt engineering”?', options: ['Writing instructions and context to get better model outputs', 'Building GPUs', 'Compressing models', 'Designing keyboards'], explain: 'Clear instructions, examples and context usually improve results.' },
  { topic: 'ml-concepts', q: 'In a classifier, a “false positive” is…', options: ['Predicting positive when the true answer is negative', 'Predicting negative when it is positive', 'A correct positive prediction', 'A missing label'], explain: 'False positives are type I errors.' },
  { topic: 'ml-concepts', q: 'What does “CNN” stand for in deep learning?', options: ['Convolutional neural network', 'Continuous neural node', 'Centralised network node', 'Compressed neural net'], explain: 'CNNs use convolutions and are widely used for images.' },
  { topic: 'ml-concepts', q: 'What is gradient descent?', options: ['Repeatedly adjusting parameters against the gradient of the loss', 'Sorting data by gradient', 'Reducing image resolution', 'Removing layers from a network'], explain: 'It moves parameters in the direction that reduces the loss.' },
  { topic: 'ml-concepts', q: 'The learning rate controls…', options: ['How big each parameter update is', 'How many layers a network has', 'How much data is collected', 'How fast the GPU runs'], explain: 'Too high can diverge; too low learns slowly.' },
  { topic: 'ml-concepts', q: 'What does “RAG” stand for in AI systems?', options: ['Retrieval-augmented generation', 'Random activation graph', 'Recurrent attention gate', 'Rapid answer generator'], explain: 'RAG retrieves relevant documents and gives them to the model as context.' },
  { topic: 'ml-concepts', q: 'Embeddings represent text as…', options: ['Vectors of numbers that capture meaning', 'Compressed ZIP files', 'Images', 'Database tables'], explain: 'Similar meanings end up as nearby vectors.' },
  { topic: 'ml-concepts', q: 'Reinforcement learning trains an agent mainly through…', options: ['Rewards from trial and error', 'Labelled examples only', 'Hand-written rules', 'Random guessing with no feedback'], explain: 'The agent learns which actions lead to higher reward.' },
  { topic: 'ml-concepts', q: 'Which technique is commonly used to reduce overfitting?', options: ['Regularisation such as dropout', 'Training for many more epochs', 'Removing the validation set', 'Using a bigger learning rate only'], explain: 'Regularisation discourages overly complex fits.' },
  { topic: 'ml-concepts', q: 'A model’s “context window” is…', options: ['The maximum amount of text it can consider at once', 'The app window it runs in', 'Its training time', 'Its file size'], explain: 'It is usually measured in tokens.' },
  { topic: 'ml-concepts', q: 'Fine-tuning means…', options: ['Further training a pre-trained model on narrower data', 'Adjusting screen brightness', 'Deleting model weights', 'Training from random initialisation'], explain: 'It adapts a general model to a specific task or style.' },
  { topic: 'ml-concepts', q: 'In AI fairness, “bias” usually refers to…', options: ['Systematically unfair outcomes for some groups', 'A bias term in a neuron only', 'A preference for fast hardware', 'Random noise in data'], explain: 'Biased data or design can lead to unequal results across groups.' },
  { topic: 'computing', q: 'What does “GPU” stand for?', options: ['Graphics processing unit', 'General processing unit', 'Global power unit', 'Graphical program utility'], explain: 'GPUs run many calculations in parallel, which suits neural networks.' },
  { topic: 'computing', q: 'Which programming language is most widely used in machine-learning research and tooling?', options: ['Python', 'COBOL', 'Fortran 77', 'Pascal'], explain: 'Python hosts most major ML libraries, such as PyTorch and scikit-learn.' },
  { topic: 'computing', q: 'How many bits are in a byte?', options: ['8', '4', '16', '10'], explain: 'A byte is 8 bits.' },
  { topic: 'computing', q: 'Binary numbers use which digits?', options: ['0 and 1', '0 to 7', '1 and 2', '0 to 9'], explain: 'Binary is base 2.' },
  { topic: 'computing', q: 'What does “HTTP” stand for?', options: ['Hypertext Transfer Protocol', 'High-Throughput Text Processing', 'Hyperlink Tracking Transfer Program', 'Host Terminal Transfer Protocol'], explain: 'HTTP is the protocol web browsers use to fetch pages.' },
  { topic: 'computing', q: 'What does “API” stand for?', options: ['Application programming interface', 'Automated program installer', 'Advanced processing integration', 'Application privacy index'], explain: 'An API defines how programs talk to each other.' },
  { topic: 'computing', q: 'TensorFlow was released as open source in 2015 by…', options: ['Google', 'Apple', 'Amazon', 'Netflix'], explain: 'Google open-sourced TensorFlow in November 2015.' },
  { topic: 'computing', q: 'PyTorch was originally developed by…', options: ['Facebook AI Research (now Meta)', 'Google', 'Microsoft', 'IBM'], explain: 'PyTorch was released by Facebook’s AI research lab in 2016.' },
  { topic: 'computing', q: 'Moore’s law observed that the number of transistors on a chip…', options: ['Doubled roughly every two years', 'Halved every year', 'Stayed constant', 'Grew by 10% per decade'], explain: 'Gordon Moore’s observation, revised in 1975 to about every two years.' },
];

export interface TriviaRound {
  questions: { q: string; options: string[]; answer: number; explain: string }[];
}

export function newTriviaRound(count: number, rng: () => number): TriviaRound {
  return {
    questions: shuffle(TRIVIA, rng)
      .slice(0, count)
      .map((t) => {
        const order = shuffle([0, 1, 2, 3], rng);
        return { q: t.q, options: order.map((i) => t.options[i]!), answer: order.indexOf(0), explain: t.explain };
      }),
  };
}
