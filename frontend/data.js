'use strict';

// ---------------------------------------------------------------------------
// Shared data contract — referenced by all Phase C modules
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Question
 * @property {string} q           - French question text
 * @property {string|null} answer - French model answer (null for AI-generated/uploaded without answer)
 * @property {string|null} translation - English translation of the French question
 * @property {string} theme       - Edexcel theme slug
 */

/**
 * @typedef {Object} HistoryEntry
 * @property {string} id
 * @property {string} question
 * @property {string} userResponse
 * @property {number} overallScore        0-9
 * @property {number} communicationScore  0-5
 * @property {number} rangeAccuracyScore  0-9
 * @property {string} correctedAnswer     French
 * @property {string|null} modelAnswer    French or null
 * @property {string} comments            English
 * @property {string|null} progressComparison English or null
 * @property {number} timestamp           Date.now()
 * @property {'seeded'|'uploaded'|'ai-generated'} source
 * @property {string} theme
 */

/**
 * @typedef {Object.<string, Array<{response:string, overallScore:number, timestamp:number}>>} QuestionHistoryMap
 * Keys are question strings; values are attempt arrays (oldest first).
 */

// ---------------------------------------------------------------------------
// Seeded question bank — 30 Q&As from the prototype, tagged with Edexcel themes
// ---------------------------------------------------------------------------
const SEEDED_QUESTIONS = [
  // home-abroad — town/region/home
  { theme: 'home-abroad', q: "Décris-moi la ville/la région où tu habites.", answer: "J'habite à Kingston, c'est une grande ville dans le sud-ouest de Londres. Il y a beaucoup de magasins et restaurants, et c'est très animé et moderne. On peut regarder un film au cinéma et jouer aux jeux vidéo dans la salle d'arcade.", translation: "Describe the town/region where you live." },
  { theme: 'home-abroad', q: "Quelle est la différence entre vivre à la campagne et vivre en ville? Que préfères-tu?", answer: "La ville a le bruit, les déchets, l'isolement, les embouteillages. La campagne offre le calme, la commodité, les divertissements, l'air pur. Je préfère la campagne parce qu'on peut décompresser. Pour moi, marcher sur la plage c'est très relaxant, loin de la ville.", translation: "What is the difference between living in the countryside and living in a city? Which do you prefer?" },
  { theme: 'home-abroad', q: "Où aimerais-tu habiter plus tard? Pourquoi?", answer: "Plus tard, j'aimerais habiter dans une grande ville parce que la ville c'est vraiment animée et il y a beaucoup de choix.", translation: "Where would you like to live later? Why?" },
  { theme: 'home-abroad', q: "Comment est-ce que la région s'est améliorée pendant les dix dernières années?", answer: "Récemment, mon pays est devenu très moderne. On construit plus d'espaces verts et plus de technologie, par exemple, des robots domestiques pour cafés et restaurants.", translation: "How has the region improved over the last ten years?" },
  { theme: 'home-abroad', q: "Décris-moi ta maison, ton jardin, etc.", answer: "Mon appartement a trois chambres, deux salles de bains, une cuisine, un salon, et une buanderie. Je reste au troisième étage du bâtiment avec mes parents. L'appartement est très grand. Je n'ai pas de jardin, mais je vais au Bushy Park.", translation: "Describe your house, your garden, etc." },
  { theme: 'home-abroad', q: "Est-ce que tu as ta propre chambre? Décris-la-moi.", answer: "Oui, j'ai une chambre. Dans ma chambre, j'ai un ordinateur de jeu, une imprimante 3D, et le piano.", translation: "Do you have your own bedroom? Describe it to me." },
  { theme: 'home-abroad', q: "Comment serait ta maison idéale et où serait-elle?", answer: "À mon avis, ma maison idéale serait un lieu avec trois étages avec un cinéma, une salle de sport, et une piscine avec un jardin.", translation: "What would your ideal house be like and where would it be?" },

  // home-abroad — travel/holidays
  { theme: 'home-abroad', q: "Préfères-tu passer les vacances à la campagne, au bord de la mer ou à la montagne? Pourquoi?", answer: "À mon avis, au bord de la mer parce que la plage c'est très divertissant comme construire des châteaux de sable. Cependant, je n'aime pas la campagne et la montagne parce qu'à la campagne c'est très ennuyeux, c'est juste du terrain vide, et à la montagne c'est très froid et ça fait mal!", translation: "Do you prefer to spend your holidays in the countryside, at the seaside or in the mountains? Why?" },
  { theme: 'home-abroad', q: "Préfères-tu les voyages organisés ou indépendants?", answer: "Je préfère les voyages indépendants parce que j'ai plus de liberté pour explorer le pays.", translation: "Do you prefer organised or independent travel?" },
  { theme: 'home-abroad', q: "Pourquoi est-ce que les voyages à l'étranger sont importants?", answer: "Les voyages à l'étranger sont très importants parce qu'on peut apprendre beaucoup sur les cultures et améliorer la communication.", translation: "Why are trips abroad important?" },
  { theme: 'home-abroad', q: "Qu'est-ce que tu as fait pendant les dernières vacances?", answer: "Je suis allé à Paris en avril l'année dernière avec mes amis pour une semaine. Le premier jour, nous avons pris l'Eurostar pendant quatre heures. C'était très fatigant, mais nous avons mangé un délicieux dîner. Le deuxième jour, nous sommes allés à Disneyland! C'était très amusant parce que l'ambiance dans le parc était parfaite. Le troisième jour, nous avons grimpé à Montmartre et mangé le dîner à huit heures.", translation: "What did you do during your last holiday?" },
  { theme: 'home-abroad', q: "Est-ce que tu as déjà passé des vacances en France? Où? C'était comment?", answer: "Oui, je suis allé à Paris en avril l'année dernière avec mes amis pour une semaine. Nous avons visité Disneyland, Montmartre, et avons pris l'Eurostar. C'était très amusant et mémorable.", translation: "Have you ever been on holiday in France? Where? What was it like?" },
  { theme: 'home-abroad', q: "Que vas-tu faire pour les prochaines vacances?", answer: "Dans les prochaines vacances, mes parents et moi irons à Copenhague. Nous explorerons la ville pendant une semaine.", translation: "What are you going to do for your next holiday?" },
  { theme: 'home-abroad', q: "Où aimerais-tu partir en vacances si tu avais beaucoup d'argent?", answer: "Si j'avais beaucoup d'argent, j'irais à Tokyo parce que dans la ville, il y a une grande variété d'activités. Par exemple, je pourrais aller dans un restaurant cinq étoiles.", translation: "Where would you like to go on holiday if you had a lot of money?" },

  // home-abroad — culture/traditions
  { theme: 'home-abroad', q: "Quelles traditions françaises connais-tu? Donne des détails.", answer: "Je connais deux traditions françaises: la Galette des Rois et la fête de la Bastille. Dans la Galette des Rois, une famille mange une tarte, et à l'intérieur il y a une figurine. Quand une personne trouve la figurine, cela représente de la bonne chance et elle devient le roi ou la reine. La fête de la Bastille représente l'assaut de la Bastille, et c'était un moment important dans l'histoire française.", translation: "What French traditions do you know? Give details." },
  { theme: 'home-abroad', q: "Quelles traditions suivez-vous dans ta famille?", answer: "Ma famille célèbre une grande tradition: le Nouvel An chinois. Nous allons dans un restaurant chinois avec mes grands-parents et mangeons de la nourriture chinoise traditionnelle.", translation: "What traditions do you follow in your family?" },

  // personal-life — relationships/family
  { theme: 'personal-life', q: "Quelles sont les caractéristiques d'un vrai ami selon toi?", answer: "Le vrai ami est très loyal, gentil et honnête. Par exemple, ils vont aider avec tes problèmes.", translation: "What are the characteristics of a true friend in your opinion?" },
  { theme: 'personal-life', q: "Décris-moi ton/ta meilleur(e) ami(e).", answer: "Mon meilleur ami a les cheveux bruns et les yeux noirs et il est très grand et fort, mais il est très gentil.", translation: "Describe your best friend to me." },
  { theme: 'personal-life', q: "Comment est-ce que tu t'entends avec tes parents? Tes frères et sœurs? Parle-moi de la dernière fois que vous vous êtes disputés.", answer: "Je m'entends bien avec mes parents et ma famille. La dernière fois que nous nous sommes disputés, c'était à propos des tâches ménagères.", translation: "How do you get along with your parents? Your siblings? Tell me about the last time you argued." },
  { theme: 'personal-life', q: "Qu'est-ce qui est le plus important pour toi, ta famille ou tes amis? Pourquoi?", answer: "Pour moi, ma famille est le plus important parce qu'ils me soutiennent toujours et sont toujours là pour moi.", translation: "What is most important to you, your family or your friends? Why?" },
  { theme: 'personal-life', q: "Comment serait la famille idéale?", answer: "La famille idéale serait une famille qui s'aime, se respecte, et passe du temps ensemble régulièrement.", translation: "What would the ideal family be like?" },

  // personal-life — routines/home life
  { theme: 'personal-life', q: "Tu as une routine journalière? Et le weekend c'est différent?", answer: "Ma routine journalière: le matin, je me réveille à sept heures trente et mange mon petit déjeuner, et brosse mes dents. Après, je vais à l'école à pied. À quatre heures de l'après-midi, je vais à l'entraînement d'aviron. Finalement, je reviens à la maison, je mange mon dîner, et dors. Cependant, le weekend, je me réveille à sept heures pour l'entraînement d'aviron au Ditton Champ.", translation: "Do you have a daily routine? Is the weekend different?" },
  { theme: 'personal-life', q: "Quelle serait ta routine idéale?", answer: "Ma routine idéale serait, je voudrais plus de temps libre pour profiter d'activités personnelles, y compris dessiner, sprinter, et jouer aux jeux vidéo avec mes amis.", translation: "What would your ideal routine be?" },
  { theme: 'personal-life', q: "À ton avis, pourquoi est-il important que les adolescents aident à la maison?", answer: "À mon avis, c'est très important que les adolescents aident à la maison parce que premièrement, ça aide avec les compétences de vie quand ils habitent seuls. Deuxièmement, aider tes parents c'est très important parce que c'est très fatigant pour eux.", translation: "In your opinion, why is it important for teenagers to help at home?" },
  { theme: 'personal-life', q: "Qu'est-ce que tu fais à la dernière fois pour aider à la maison?", answer: "Oui. Je range toutes les chambres, je fais la lessive, et mes parents cuisinent la nourriture et font la vaisselle.", translation: "What did you last do to help at home?" },
  { theme: 'personal-life', q: "Est-ce que les tâches ménagères sont partagées équitablement chez toi?", answer: "Oui. Je range toutes les chambres, je fais la lessive, et mes parents cuisinent la nourriture et font la vaisselle.", translation: "Are household chores shared fairly at your place?" },

  // world-around-us — transport
  { theme: 'world-around-us', q: "Quel mode de transport utilises-tu et quand/pourquoi?", answer: "J'utilise trois modes de transport: le train, le bus, et la voiture. Pendant la semaine, je prends le train le matin pour aller à l'école tous les jours. Cependant, le weekend, quand je dois aller à l'entraînement d'aviron, mes parents me prennent en voiture, et depuis le Ditton Champ, je prends le bus.", translation: "What mode of transport do you use and when/why?" },
  { theme: 'world-around-us', q: "Quels sont les avantages et les inconvénients?", answer: "Les avantages de la voiture c'est que c'est très rapide et confortable, mais il y a beaucoup de circulation.", translation: "What are the advantages and disadvantages?" },
  { theme: 'world-around-us', q: "Comment sont les transports en commun dans ta ville et comment pourrait-on les améliorer?", answer: "Les transports en commun sont corrects, mais il y a beaucoup de déchets et ça sent mauvais.", translation: "What is public transport like in your town and how could it be improved?" },

  // social-activities — cinema/books/leisure
  { theme: 'social-activities', q: "Préfères-tu lire ou regarder un film? Pourquoi?", answer: "Je préfère regarder un film parce que c'est beaucoup plus divertissant comparé à un livre parce que ça prend du temps.", translation: "Do you prefer reading or watching a film? Why?" },
  { theme: 'social-activities', q: "Quel est le dernier livre que tu as lu?", answer: "Je lis une bande dessinée de Marvel. C'est très intéressant parce qu'il y a beaucoup d'action.", translation: "What is the last book you read?" },
  { theme: 'social-activities', q: "Raconte-moi la dernière fois que tu es allé au cinéma: qu'est-ce que tu as vu, c'était comment?", answer: "La dernière fois que je suis allé au cinéma, c'était il y a trois semaines. J'ai regardé 'Project Hail Mary' avec mes amis, c'était très drôle et sincère.", translation: "Tell me about the last time you went to the cinema: what did you see and what was it like?" },
];

// ---------------------------------------------------------------------------
// Active question bank — starts as seeded, replaced by upload or AI generation
// ---------------------------------------------------------------------------
let activeQuestions = [...SEEDED_QUESTIONS];
let activeSource = 'seeded'; // 'seeded' | 'uploaded' | 'ai-generated'

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------
const LS_HISTORY = 'frenchie_history';
const LS_QUESTION_HISTORY = 'frenchie_questionHistory';
const TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
