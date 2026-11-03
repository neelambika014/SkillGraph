// Generates the whole SkillGraph dataset (JSON + CSV) into this folder.
//   node data/build.js
const fs = require('fs');
const path = require('path');
const { generateCandidates } = require('../src/services/synthetic');

const OUT = __dirname;

// ---------------------------------------------------------------------------
// 1. SKILL TAXONOMY   "Name|aliases|Group|prerequisites|docs url"
// ---------------------------------------------------------------------------
const TAXONOMY = {
  'Web Development': [
    'HTML|html5|Frontend||https://developer.mozilla.org/en-US/docs/Learn/HTML',
    'CSS|css3|Frontend|HTML|https://developer.mozilla.org/en-US/docs/Learn/CSS',
    'JavaScript|js,ecmascript,es6,vanilla js|Frontend|HTML|https://developer.mozilla.org/en-US/docs/Learn/JavaScript',
    'TypeScript||Frontend|JavaScript|https://www.typescriptlang.org/docs',
    'React|reactjs,react.js|Frontend|JavaScript|https://react.dev',
    'Next.js|nextjs|Frontend|React|https://nextjs.org/docs',
    'Vue.js|vue,vuejs|Frontend|JavaScript|https://vuejs.org/guide',
    'Angular|angularjs|Frontend|TypeScript|https://angular.dev',
    'Redux|redux toolkit,zustand|Frontend|React|https://redux-toolkit.js.org',
    'Tailwind CSS|tailwind,tailwindcss|Frontend|CSS|https://tailwindcss.com/docs',
    'Bootstrap||Frontend|CSS|https://getbootstrap.com/docs',
    'Responsive Design|responsive web design,mobile-first,media queries|Frontend|CSS|https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design',
    'Webpack|vite,bundler,bundlers,babel|Frontend|JavaScript|https://webpack.js.org/concepts',
    'Node.js|nodejs,node js|Backend|JavaScript|https://nodejs.org/en/learn',
    'Express.js|expressjs,express js|Backend|Node.js|https://expressjs.com',
    'REST API Design|restful,rest api,rest apis,api design,api development,web services|Backend||https://restfulapi.net',
    'GraphQL|apollo graphql,apollo server|Backend|REST API Design|https://graphql.org/learn',
    'Authentication|auth,jwt,oauth,oauth2,json web token,session management,authorization,passport.js|Backend||https://owasp.org/www-project-authentication-cheat-sheet',
    'WebSockets|websocket,socket.io|Backend|Node.js|https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API',
    'Django|django rest framework|Backend|Python|https://docs.djangoproject.com',
    'Flask||Backend|Python|https://flask.palletsprojects.com',
    'FastAPI||Backend|Python|https://fastapi.tiangolo.com',
    'Spring Boot|springboot,spring framework,spring mvc|Backend|Java|https://spring.io/guides',
    'Microservices|microservice,microservices architecture|Backend|REST API Design|https://microservices.io',
  ],
  'Databases': [
    'SQL|structured query language,sql queries|Relational||https://www.w3schools.com/sql',
    'MySQL||Relational|SQL|https://dev.mysql.com/doc',
    'PostgreSQL|postgres,psql|Relational|SQL|https://www.postgresql.org/docs',
    'MongoDB|mongo,mongoose,mongo db,nosql|NoSQL||https://www.mongodb.com/docs',
    'Redis||NoSQL||https://redis.io/docs',
    'Elasticsearch|elastic search,elk stack|NoSQL||https://www.elastic.co/guide',
    'Firebase|firestore|NoSQL||https://firebase.google.com/docs',
    'Database Design|schema design,data modeling,data modelling,normalization,erd,er diagram|Design||https://www.mongodb.com/docs/manual/data-modeling',
    'Data Warehousing|snowflake,bigquery,redshift,data warehouse|Analytics|SQL|https://cloud.google.com/bigquery/docs',
  ],
  'Programming Languages': [
    'Python|python3|Languages||https://docs.python.org/3/tutorial',
    'Java|core java|Languages||https://dev.java/learn',
    'C|c programming|Languages||https://www.learn-c.org',
    'C++|cpp|Languages|C|https://en.cppreference.com',
    'C#|csharp,.net,dotnet|Languages||https://learn.microsoft.com/dotnet/csharp',
    'Go|golang|Languages||https://go.dev/doc',
    'Rust||Languages||https://doc.rust-lang.org/book',
    'PHP|laravel|Languages||https://www.php.net/manual',
    'Ruby|ruby on rails,rails|Languages||https://www.ruby-lang.org/en/documentation',
    'Kotlin||Languages|Java|https://kotlinlang.org/docs',
    'Swift||Languages||https://www.swift.org/documentation',
    'Dart||Languages||https://dart.dev/guides',
    'R|r programming,rstudio|Languages||https://www.r-project.org/other-docs.html',
    'Data Structures & Algorithms|dsa,algorithms,data structures,leetcode,competitive programming|CS Fundamentals||https://www.geeksforgeeks.org/dsa-tutorial-learn-data-structures-and-algorithms',
    'Object-Oriented Programming|oop,object oriented programming,object oriented design|CS Fundamentals||https://www.freecodecamp.org/news/object-oriented-programming-concepts',
    'Operating Systems|os concepts,process scheduling,memory management|CS Fundamentals||https://pages.cs.wisc.edu/~remzi/OSTEP',
  ],
  'Data Science & AI': [
    'Excel|microsoft excel,spreadsheets,pivot tables,google sheets|Data Analysis||https://support.microsoft.com/excel',
    'Statistics|statistical analysis,hypothesis testing,probability,a/b testing|Data Analysis||https://www.khanacademy.org/math/statistics-probability',
    'Pandas||Data Analysis|Python|https://pandas.pydata.org/docs',
    'NumPy||Data Analysis|Python|https://numpy.org/doc',
    'Data Visualization|matplotlib,seaborn,plotly,tableau,power bi,powerbi,data viz,d3.js,dashboards|Data Analysis||https://www.data-to-viz.com',
    'Machine Learning|ml,scikit-learn,sklearn,supervised learning,xgboost,random forest|Machine Learning|Python,Statistics|https://scikit-learn.org/stable/user_guide.html',
    'Deep Learning|neural networks,neural network,cnn,rnn,lstm,transformers|Machine Learning|Machine Learning|https://www.deeplearning.ai',
    'TensorFlow|keras,tensorflow lite|Machine Learning|Deep Learning|https://www.tensorflow.org/learn',
    'PyTorch|torch|Machine Learning|Deep Learning|https://pytorch.org/tutorials',
    'NLP|natural language processing,text mining,spacy,nltk,hugging face|Machine Learning|Machine Learning|https://huggingface.co/learn/nlp-course',
    'Computer Vision|opencv,image processing,object detection,yolo|Machine Learning|Deep Learning|https://docs.opencv.org',
    'LLMs|large language models,llm,prompt engineering,openai api,langchain,rag,retrieval augmented generation,generative ai,vector database|Generative AI|NLP|https://platform.openai.com/docs',
    'MLOps|mlflow,model deployment,model serving,kubeflow|Machine Learning|Machine Learning,Docker|https://ml-ops.org',
    'Data Engineering|etl,airflow,data pipelines,data pipeline,dbt|Data Engineering|SQL,Python|https://airflow.apache.org/docs',
    'Apache Spark|spark,pyspark|Data Engineering|Python,SQL|https://spark.apache.org/docs/latest',
    'Apache Kafka|kafka|Data Engineering||https://kafka.apache.org/documentation',
  ],
  'DevOps & Cloud': [
    'Git|github,gitlab,version control,bitbucket|Fundamentals||https://git-scm.com/doc',
    'Linux|bash,shell scripting,unix,ubuntu,shell|Fundamentals||https://linuxjourney.com',
    'Networking|tcp/ip,dns,http protocol,computer networks,load balancing|Fundamentals||https://www.cloudflare.com/learning',
    'Docker|containers,dockerfile,docker compose,containerization|Containers|Linux|https://docs.docker.com',
    'Kubernetes|k8s,helm|Containers|Docker|https://kubernetes.io/docs',
    'CI/CD|github actions,jenkins,gitlab ci,continuous integration,continuous deployment,circleci|Automation|Git|https://docs.github.com/actions',
    'AWS|amazon web services,ec2,s3,aws lambda,cloudformation|Cloud|Linux|https://docs.aws.amazon.com',
    'Azure|microsoft azure|Cloud||https://learn.microsoft.com/azure',
    'Google Cloud|gcp,google cloud platform|Cloud||https://cloud.google.com/docs',
    'Terraform|infrastructure as code,iac,pulumi|Infrastructure|AWS|https://developer.hashicorp.com/terraform/docs',
    'Ansible||Infrastructure|Linux|https://docs.ansible.com',
    'Monitoring|prometheus,grafana,observability,datadog,logging|Observability|Linux|https://prometheus.io/docs',
    'Nginx|reverse proxy,web server|Web Servers|Linux|https://nginx.org/en/docs',
  ],
  'Mobile Development': [
    'React Native|react-native,expo|Cross-platform|React|https://reactnative.dev/docs/getting-started',
    'Flutter||Cross-platform|Dart|https://docs.flutter.dev',
    'Android Development|android,android studio,jetpack compose|Native|Kotlin|https://developer.android.com/courses',
    'iOS Development|ios,xcode,swiftui,uikit|Native|Swift|https://developer.apple.com/tutorials/app-dev-training',
  ],
  'Cybersecurity': [
    'Network Security|firewall,firewalls,vpn,ids,ips,intrusion detection|Defense|Networking|https://www.cisco.com/c/en/us/products/security/what-is-network-security.html',
    'Ethical Hacking|penetration testing,pentest,pentesting,kali linux,burp suite,metasploit,ctf|Offense|Networking,Linux|https://tryhackme.com',
    'Web Security|owasp,xss,csrf,sql injection,owasp top 10|Defense|Networking|https://owasp.org/www-project-top-ten',
    'Cryptography|encryption,pki,hashing,tls|Fundamentals||https://www.coursera.org/learn/crypto',
    'SIEM|splunk,security monitoring,soc,log analysis|Defense|Networking|https://www.splunk.com/en_us/training.html',
    'Incident Response|digital forensics,threat hunting,malware analysis|Defense|SIEM|https://www.sans.org/blog/incident-response-resources',
  ],
  'UI/UX Design': [
    'Figma|figma design,adobe xd,sketch app|Tools||https://help.figma.com',
    'UI Design|ui,visual design,user interface design,typography,color theory|Design||https://www.nngroup.com/articles',
    'UX Research|user research,usability testing,personas,user interviews,user journey|Research||https://www.nngroup.com/articles/ux-research-cheat-sheet',
    'Wireframing|prototyping,wireframes,low-fidelity,mockups|Design||https://www.interaction-design.org/literature/topics/wireframing',
    'Design Systems|design system,component library,design tokens,storybook|Design|UI Design|https://www.designsystems.com',
    'Accessibility|a11y,wcag,aria,screen reader|Design||https://www.w3.org/WAI/fundamentals',
  ],
  'Software Engineering': [
    'Unit Testing|jest,mocha,pytest,junit,tdd,test-driven development,unit tests,vitest|Quality||https://jestjs.io/docs/getting-started',
    'Test Automation|selenium,cypress,playwright,qa automation,automated testing,appium,e2e testing|Quality||https://playwright.dev/docs/intro',
    'Agile|scrum,kanban,jira,sprint planning|Process||https://agilemanifesto.org',
    'Design Patterns|solid principles,gang of four|Design|Object-Oriented Programming|https://refactoring.guru/design-patterns',
    'System Design|distributed systems,scalability,high availability,system architecture|Architecture||https://github.com/donnemartin/system-design-primer',
    'Documentation|technical writing,api documentation,swagger,openapi|Process||https://www.writethedocs.org/guide',
  ],
  'Game Development': [
    'Unity|unity3d,unity engine|Engines|C#|https://learn.unity.com',
    'Unreal Engine|unreal,ue5,blueprints|Engines|C++|https://dev.epicgames.com/community/unreal-engine/learning',
    '3D Modeling|blender,maya,3d modelling,3ds max|Art||https://www.blender.org/support/tutorials',
  ],
  'Soft Skills': [
    'Communication|communication skills,public speaking,presentation skills,written communication|Interpersonal||',
    'Teamwork|team player,collaboration,cross-functional|Interpersonal||',
    'Leadership|team lead,mentoring,led a team,team leadership|Interpersonal||',
    'Problem Solving|analytical thinking,critical thinking,troubleshooting,debugging|Cognitive||',
    'Project Management|project planning,stakeholder management,product management,roadmapping|Management||',
  ],
};

// ---------------------------------------------------------------------------
// 2. CAREERS   requirement format "Skill:minLevel(1-4):weight(1-5)"
// ---------------------------------------------------------------------------
const CAREER_DEFS = [
  ['full-stack-developer', 'Full Stack Developer', 'Web Development', 92, 'Builds complete web applications: UI, APIs, databases and deployment.',
    'HTML:3:3,CSS:3:3,JavaScript:3:5,TypeScript:2:3,React:3:5,Next.js:2:3,Node.js:3:5,Express.js:3:4,REST API Design:3:4,Authentication:3:4,MongoDB:3:4,SQL:2:3,Database Design:2:3,Git:3:4,Docker:2:2,Unit Testing:2:2,Responsive Design:3:3,Communication:2:2'],
  ['frontend-developer', 'Frontend Developer', 'Web Development', 88, 'Crafts fast, accessible, beautiful user interfaces.',
    'HTML:4:4,CSS:4:4,JavaScript:4:5,TypeScript:3:4,React:4:5,Next.js:3:3,Redux:2:2,Tailwind CSS:3:3,Responsive Design:4:4,Accessibility:3:3,Webpack:2:1,Git:3:3,Unit Testing:2:2,Figma:2:2'],
  ['backend-developer', 'Backend Developer', 'Web Development', 90, 'Designs APIs, services and data layers that scale.',
    'Node.js:4:4,Express.js:3:3,Python:3:3,REST API Design:4:5,Authentication:4:4,SQL:4:5,PostgreSQL:3:4,MongoDB:3:3,Redis:2:3,Database Design:4:4,Microservices:3:3,Docker:3:3,Git:3:3,Unit Testing:3:3,System Design:3:3,GraphQL:2:2,Linux:2:2'],
  ['data-analyst', 'Data Analyst', 'Data Science & AI', 86, 'Turns raw data into insight with SQL, spreadsheets and dashboards.',
    'SQL:4:5,Excel:3:3,Python:3:4,Pandas:3:4,NumPy:2:2,Data Visualization:4:5,Statistics:3:4,Data Warehousing:2:2,Communication:3:3,Problem Solving:3:2'],
  ['data-scientist', 'Data Scientist', 'Data Science & AI', 84, 'Builds statistical and machine learning models to answer business questions.',
    'Python:4:5,Pandas:4:4,NumPy:3:3,Statistics:4:5,Machine Learning:4:5,Data Visualization:3:3,SQL:3:4,Deep Learning:2:2,NLP:2:1,Git:2:2,Communication:3:3'],
  ['ml-engineer', 'Machine Learning Engineer', 'Data Science & AI', 87, 'Takes ML models from notebook to production.',
    'Python:4:5,Machine Learning:4:5,Deep Learning:3:4,TensorFlow:3:3,PyTorch:3:3,MLOps:3:4,Docker:3:3,Data Engineering:2:2,SQL:3:3,Git:3:3,AWS:2:3,NLP:2:2,Unit Testing:2:1'],
  ['llm-engineer', 'AI / LLM Engineer', 'Data Science & AI', 95, 'Builds applications on top of large language models.',
    'Python:4:5,LLMs:3:5,NLP:3:4,Machine Learning:3:3,FastAPI:3:3,REST API Design:3:3,Docker:2:2,PostgreSQL:2:2,Redis:2:1,Git:3:3,AWS:2:2,JavaScript:2:1,System Design:2:2'],
  ['devops-engineer', 'DevOps Engineer', 'DevOps & Cloud', 91, 'Automates build, deploy and operations of software systems.',
    'Linux:4:5,Git:4:4,Docker:4:5,Kubernetes:3:5,CI/CD:4:5,AWS:3:4,Terraform:3:4,Ansible:2:2,Monitoring:3:4,Networking:3:3,Python:2:2,Nginx:2:2'],
  ['cloud-engineer', 'Cloud Engineer', 'DevOps & Cloud', 89, 'Designs and runs secure, cost-effective cloud infrastructure.',
    'AWS:4:5,Azure:2:2,Google Cloud:2:2,Linux:3:4,Networking:3:4,Terraform:3:4,Docker:3:3,Kubernetes:2:3,CI/CD:3:3,Python:2:2,Monitoring:2:2,Network Security:2:2'],
  ['mobile-developer', 'Mobile App Developer', 'Mobile Development', 82, 'Ships apps for Android, iOS or both.',
    'Kotlin:3:3,Android Development:3:3,Swift:2:2,Flutter:3:3,Dart:3:3,React Native:3:3,REST API Design:3:3,Firebase:3:3,Git:3:3,UI Design:2:2,Unit Testing:2:2'],
  ['cybersecurity-analyst', 'Cybersecurity Analyst', 'Cybersecurity', 93, 'Detects, investigates and prevents security threats.',
    'Networking:4:5,Linux:3:4,Network Security:4:5,Ethical Hacking:3:4,Web Security:3:4,Cryptography:3:3,SIEM:3:4,Incident Response:3:4,Python:2:2,Authentication:3:2,Communication:3:2'],
  ['ux-designer', 'UI/UX Designer', 'UI/UX Design', 80, 'Designs intuitive products grounded in user research.',
    'Figma:4:5,UI Design:4:5,UX Research:3:4,Wireframing:4:4,Design Systems:3:3,Accessibility:3:3,HTML:2:1,CSS:2:1,Communication:3:3'],
  ['game-developer', 'Game Developer', 'Game Development', 74, 'Builds interactive games and real-time 3D experiences.',
    'Unity:3:5,C#:3:5,C++:2:2,Unreal Engine:2:3,3D Modeling:2:2,Data Structures & Algorithms:3:3,Object-Oriented Programming:3:3,Git:3:3,Problem Solving:3:2,Teamwork:2:2'],
  ['qa-automation-engineer', 'QA Automation Engineer', 'Software Engineering', 78, 'Builds automated test suites that keep releases safe.',
    'Test Automation:4:5,Unit Testing:3:4,JavaScript:3:3,Python:3:3,Git:3:3,CI/CD:3:3,REST API Design:2:3,SQL:2:2,Agile:3:3,Communication:3:2,Documentation:2:1'],
];

// ---------------------------------------------------------------------------
// 3. INTERESTS / HOBBIES -> careers
// ---------------------------------------------------------------------------
const INTERESTS = [
  ['gaming', 'Gaming', 'gaming,video games,esports,minecraft,steam,console', 'game-developer,ux-designer,full-stack-developer', 'Unity,C#,3D Modeling,UI Design', 'You enjoy interactive systems - game development, UX and real-time apps reward exactly that curiosity.'],
  ['photography', 'Photography', 'photography,photo editing,videography,filmmaking,cinematography', 'ux-designer,frontend-developer,game-developer', 'UI Design,Figma,3D Modeling,Accessibility', 'A trained visual eye transfers directly to interface and visual design.'],
  ['drawing', 'Drawing & Art', 'drawing,painting,sketching,art,illustration,calligraphy,digital art', 'ux-designer,frontend-developer,game-developer', 'Figma,UI Design,Wireframing,3D Modeling', 'Creative and visual practice maps well onto design and front-end craft.'],
  ['music', 'Music', 'music,singing,guitar,piano,dj,audio production', 'game-developer,ml-engineer,frontend-developer', 'Unity,Python,NLP', 'Pattern, rhythm and structure appear in audio tech, generative AI and interactive media.'],
  ['chess', 'Chess & Puzzles', 'chess,puzzles,sudoku,rubik,brain teasers,strategy games,board games', 'backend-developer,data-scientist,ml-engineer', 'Data Structures & Algorithms,Problem Solving,Statistics', 'Strategic thinking and pattern recognition are core to algorithms and data work.'],
  ['writing', 'Reading & Writing', 'writing,blogging,reading,poetry,journalism,storytelling,books', 'llm-engineer,ux-designer,data-analyst', 'NLP,LLMs,UX Research,Communication,Documentation', 'Strong language skills pair well with NLP, content-heavy UX and data storytelling.'],
  ['robotics', 'Robotics & Electronics', 'robotics,arduino,raspberry pi,electronics,iot,drones,hardware', 'ml-engineer,cybersecurity-analyst,mobile-developer', 'Python,C++,Computer Vision,Linux', 'Hands-on hardware tinkering leads naturally into embedded, CV and security work.'],
  ['finance', 'Finance & Investing', 'stocks,investing,trading,finance,economics,crypto,personal finance', 'data-analyst,data-scientist,backend-developer', 'SQL,Statistics,Excel,Data Visualization', 'Comfort with numbers and markets suits analytics and quantitative roles.'],
  ['sports', 'Sports & Fitness', 'cricket,football,sports,fitness,running,gym,yoga,basketball,tennis', 'data-analyst,mobile-developer,data-scientist', 'Data Visualization,Statistics,Flutter', 'Sports analytics and fitness apps are two booming data/mobile niches.'],
  ['hacking', 'Hacking & CTFs', 'hacking,ctf,capture the flag,lockpicking,security,privacy,tryhackme', 'cybersecurity-analyst,devops-engineer,backend-developer', 'Ethical Hacking,Linux,Networking,Web Security', 'Curiosity about how systems break is the foundation of a security career.'],
  ['teaching', 'Teaching & Volunteering', 'teaching,tutoring,volunteering,mentoring,community,ngo,public speaking', 'ux-designer,data-analyst,full-stack-developer', 'Communication,UX Research,Leadership', 'Empathy and clear explanation are underrated engineering and UX strengths.'],
  ['travel', 'Travel & Maps', 'travel,hiking,maps,geography,trekking,backpacking,vlogging', 'mobile-developer,data-analyst,full-stack-developer', 'Flutter,React Native,Data Visualization', 'Travel apps, maps and geo data are classic portfolio themes.'],
  ['cooking', 'Cooking & Food', 'cooking,baking,food,recipes,coffee,restaurants', 'ux-designer,full-stack-developer,mobile-developer', 'UX Research,React,Firebase', 'Recipe, ordering and delivery products are approachable full-stack and UX projects.'],
  ['automation', 'Home Automation & Gadgets', 'automation,smart home,gadgets,tinkering,3d printing,home lab,homelab,self-hosting', 'devops-engineer,cloud-engineer,backend-developer', 'Linux,Docker,Networking,Python', 'Self-hosting and home labs are practice runs for DevOps and cloud work.'],
  ['social', 'Social Media & Content', 'social media,youtube,content creation,podcast,streaming,marketing,influencer', 'frontend-developer,data-analyst,ux-designer', 'Data Visualization,UI Design,Next.js', 'Audience growth and content analytics reward both design and data skills.'],
];

// ---------------------------------------------------------------------------
// 4. PROJECT IDEAS   "Title|description|Skill,Skill|difficulty 1-3|hours"
// ---------------------------------------------------------------------------
const IDEAS = [
  'Personal Portfolio Website|Responsive portfolio with project gallery, contact form and dark mode.|HTML,CSS,JavaScript,Responsive Design|1|15',
  'Task Manager with Auth|Kanban-style task app with sign-up, JWT login and per-user boards.|React,Node.js,Express.js,MongoDB,Authentication,REST API Design|2|40',
  'E-commerce Storefront|Product catalogue, cart, checkout flow and admin panel.|Next.js,React,MongoDB,Authentication,REST API Design,Database Design|3|80',
  'Real-time Chat App|Rooms, typing indicators and message history over websockets.|Node.js,WebSockets,React,MongoDB|2|35',
  'Blog Platform with Markdown|Markdown editor, tags, comments and SEO-friendly pages.|Next.js,TypeScript,PostgreSQL,Authentication|2|45',
  'URL Shortener with Analytics|Short links with click tracking, Redis cache and a stats dashboard.|Node.js,Express.js,Redis,MongoDB,REST API Design|2|25',
  'REST API for a Library System|Documented CRUD API with auth, pagination and automated tests.|Node.js,Express.js,SQL,PostgreSQL,Unit Testing,Documentation|2|30',
  'GraphQL Social Feed|Posts, likes and follows served via a typed GraphQL schema.|GraphQL,Node.js,MongoDB,TypeScript,Authentication|3|50',
  'Microservices Food Delivery|Orders, payments and notifications as independent services.|Microservices,Docker,Node.js,REST API Design,Redis|3|90',
  'Component Library with Storybook|Accessible, documented React components published to npm.|React,TypeScript,Design Systems,Accessibility,Unit Testing|2|40',
  'Weather Dashboard|Search any city, charts for forecast, caching of API calls.|JavaScript,React,Data Visualization,REST API Design|1|18',
  'Sales Analytics Dashboard|Clean a sales dataset with SQL/pandas and build an interactive dashboard.|SQL,Pandas,Excel,Data Visualization,Statistics|2|30',
  'COVID / Public Data Explorer|Exploratory analysis on an open dataset with a written findings report.|Python,Pandas,NumPy,Data Visualization,Statistics,Communication|1|25',
  'Customer Churn Predictor|End-to-end classification model with evaluation and explanation.|Python,Pandas,Machine Learning,Statistics,Data Visualization|2|35',
  'House Price Prediction|Regression with feature engineering and cross-validation.|Python,Pandas,NumPy,Machine Learning|1|20',
  'Image Classifier Web App|Train a CNN and serve predictions behind a small API.|Python,Deep Learning,TensorFlow,Flask,Docker|3|60',
  'Sentiment Analysis on Reviews|Fine-tune or apply a transformer to classify product reviews.|Python,NLP,PyTorch,Machine Learning|2|35',
  'Resume Screening Assistant|LLM-powered resume summariser with embeddings-based search.|Python,LLMs,NLP,FastAPI,PostgreSQL|3|55',
  'RAG Chatbot over Your Docs|Chat with PDFs using a vector store and an LLM.|Python,LLMs,FastAPI,Redis,Docker|3|50',
  'ML Model Deployment Pipeline|Containerise a model, add CI/CD and monitoring.|MLOps,Docker,CI/CD,Python,Monitoring|3|55',
  'ETL Pipeline with Airflow|Ingest, transform and load daily data into a warehouse.|Data Engineering,Python,SQL,Apache Spark,Data Warehousing|3|60',
  'Dockerised Multi-tier App|Containerise frontend, API and database with docker compose.|Docker,Linux,Nginx,Git|1|20',
  'CI/CD Pipeline for a Web App|Lint, test, build and deploy automatically on every push.|CI/CD,Git,Docker,Linux,Unit Testing|2|25',
  'Kubernetes Cluster Deployment|Deploy and scale a service with probes, secrets and ingress.|Kubernetes,Docker,Linux,Monitoring|3|45',
  'Cloud Infrastructure with Terraform|Provision a VPC, compute and database as code on AWS.|Terraform,AWS,Networking,Linux|3|50',
  'Monitoring Stack|Prometheus + Grafana dashboards and alerts for a sample service.|Monitoring,Linux,Docker,Networking|2|25',
  'Expense Tracker Mobile App|Offline-first expense app with charts and cloud sync.|Flutter,Dart,Firebase,UI Design|2|45',
  'Fitness Tracker App|Track workouts with React Native and a small backend.|React Native,JavaScript,REST API Design,Firebase|2|50',
  'Android Notes App|Native notes app with local storage and search.|Kotlin,Android Development,Unit Testing|2|35',
  'Vulnerability Scanner Lab|Scan a deliberately vulnerable app and write a remediation report.|Ethical Hacking,Web Security,Linux,Networking,Documentation|2|30',
  'SIEM Home Lab|Ship logs into Splunk/ELK, build detections and an incident playbook.|SIEM,Incident Response,Linux,Networking|3|45',
  'Password Manager (Crypto)|Client-side encrypted vault with strong key derivation.|Cryptography,Authentication,JavaScript,Web Security|3|40',
  'Mobile Banking App Redesign|Research, wireframe and prototype a redesigned banking flow.|Figma,UX Research,Wireframing,UI Design,Accessibility|2|35',
  'Design System in Figma|Tokens, components and usage guidelines for a fictional brand.|Figma,Design Systems,UI Design,Accessibility|2|35',
  '2D Platformer Game|Complete Unity platformer with levels, enemies and a menu.|Unity,C#,Object-Oriented Programming,Problem Solving|2|60',
  '3D Environment Demo|Blender scene imported into Unreal with lighting and interaction.|Unreal Engine,3D Modeling,C++|3|70',
  'Automated E2E Test Suite|Playwright/Cypress tests with CI reporting for a demo shop.|Test Automation,JavaScript,CI/CD,Git,Agile|2|30',
  'Algorithm Visualiser|Interactive sorting and pathfinding visualisations.|Data Structures & Algorithms,JavaScript,React,Problem Solving|1|25',
  'Skill-Based Job Matcher|Match resumes to job posts by skill graph overlap.|Python,Pandas,SQL,Machine Learning,Database Design|2|40',
];

const CERTS = [
  'AWS Certified Cloud Practitioner|Amazon Web Services|AWS,Networking',
  'AWS Certified Solutions Architect - Associate|Amazon Web Services|AWS,Networking,System Design',
  'Microsoft Azure Fundamentals (AZ-900)|Microsoft|Azure',
  'Google Cloud Digital Leader|Google Cloud|Google Cloud',
  'Certified Kubernetes Administrator (CKA)|CNCF|Kubernetes,Docker,Linux',
  'HashiCorp Terraform Associate|HashiCorp|Terraform',
  'MongoDB Associate Developer|MongoDB University|MongoDB,Database Design',
  'Meta Front-End Developer Certificate|Coursera / Meta|HTML,CSS,JavaScript,React',
  'Full Stack Web Development Bootcamp|Udemy|HTML,CSS,JavaScript,Node.js,MongoDB',
  'Google Data Analytics Certificate|Coursera / Google|SQL,Data Visualization,Excel,Statistics',
  'IBM Data Science Professional Certificate|Coursera / IBM|Python,Pandas,Machine Learning,SQL',
  'Machine Learning Specialization|DeepLearning.AI|Machine Learning,Python,Deep Learning',
  'TensorFlow Developer Certificate|Google|TensorFlow,Deep Learning',
  'CompTIA Security+|CompTIA|Network Security,Cryptography,Networking',
  'Certified Ethical Hacker (CEH)|EC-Council|Ethical Hacking,Web Security',
  'Google UX Design Certificate|Coursera / Google|Figma,UX Research,Wireframing,UI Design',
  'Unity Certified User|Unity|Unity,C#',
  'ISTQB Foundation Level|ISTQB|Test Automation,Agile',
  'Oracle Certified Java Programmer|Oracle|Java,Object-Oriented Programming',
  'Scrum Master (PSM I)|Scrum.org|Agile,Project Management',
];

// ---------------------------------------------------------------------------
// BUILD
// ---------------------------------------------------------------------------
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9+#]+/g, '-').replace(/^-|-$/g, '');
const skills = [];
for (const [domain, lines] of Object.entries(TAXONOMY)) {
  for (const line of lines) {
    const [name, aliases = '', group = '', pre = '', docs = ''] = line.split('|');
    skills.push({
      name,
      slug: slug(name),
      domain,
      group,
      aliases: aliases ? aliases.split(',').map((s) => s.trim()).filter(Boolean) : [],
      prerequisites: pre ? pre.split(',').map((s) => s.trim()) : [],
      docs: docs || '',
    });
  }
}
const names = new Set(skills.map((s) => s.name));
if (names.size !== skills.length) throw new Error('Duplicate skill names');
for (const s of skills) for (const p of s.prerequisites) if (!names.has(p)) throw new Error(`Unknown prerequisite ${p} for ${s.name}`);

const careers = CAREER_DEFS.map(([slugId, title, domain, demand, description, reqs]) => {
  const requirements = reqs.split(',').map((r) => {
    const [skill, level, weight] = r.split(':');
    if (!names.has(skill)) throw new Error(`Career ${title}: unknown skill "${skill}"`);
    return { skill, level: +level, weight: +weight };
  });
  return { slug: slugId, title, domain, demand, description, requirements };
});

const interests = INTERESTS.map(([id, label, keywords, cs, sk, why]) => {
  const careerSlugs = cs.split(',');
  for (const c of careerSlugs) if (!careers.some((x) => x.slug === c)) throw new Error(`Interest ${id}: unknown career ${c}`);
  const sks = sk.split(',');
  for (const s of sks) if (!names.has(s)) throw new Error(`Interest ${id}: unknown skill ${s}`);
  return { id, label, keywords: keywords.split(','), careers: careerSlugs, skills: sks, why };
});

const ideas = IDEAS.map((l) => {
  const [title, description, sk, difficulty, hours] = l.split('|');
  const sks = sk.split(',');
  for (const s of sks) if (!names.has(s)) throw new Error(`Idea "${title}": unknown skill ${s}`);
  return { title, description, skills: sks, difficulty: +difficulty, hours: +hours };
});

const certs = CERTS.map((l) => {
  const [name, issuer, sk] = l.split('|');
  const sks = sk.split(',');
  for (const s of sks) if (!names.has(s)) throw new Error(`Cert "${name}": unknown skill ${s}`);
  return { name, issuer, skills: sks };
});

const candidates = generateCandidates({ skills, careers, ideas, certs, interests, count: 150, seed: 2026 });

// ---- write JSON
const write = (f, d) => fs.writeFileSync(path.join(OUT, f), typeof d === 'string' ? d : JSON.stringify(d, null, 2));
write('skills.json', skills);
write('careers.json', careers);
write('interests.json', interests);
write('project_ideas.json', ideas);
write('certifications.json', certs);
write('candidates.json', candidates);

// ---- write CSV
const csv = (rows, cols) => {
  const q = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n') + '\n';
};
write('skills.csv', csv(skills.map((s) => ({ ...s, aliases: s.aliases.join(';'), prerequisites: s.prerequisites.join(';') })), ['name', 'domain', 'group', 'aliases', 'prerequisites', 'docs']));
write('career_requirements.csv', csv(careers.flatMap((c) => c.requirements.map((r) => ({ career: c.title, career_slug: c.slug, domain: c.domain, demand: c.demand, skill: r.skill, min_level: r.level, weight: r.weight }))), ['career', 'career_slug', 'domain', 'demand', 'skill', 'min_level', 'weight']));
write('interest_career_map.csv', csv(interests.flatMap((i) => i.careers.map((c) => ({ interest: i.id, label: i.label, career_slug: c, helpful_skills: i.skills.join(';') }))), ['interest', 'label', 'career_slug', 'helpful_skills']));
write('project_ideas.csv', csv(ideas.map((i) => ({ ...i, skills: i.skills.join(';') })), ['title', 'description', 'skills', 'difficulty', 'hours']));
write('certifications.csv', csv(certs.map((c) => ({ ...c, skills: c.skills.join(';') })), ['name', 'issuer', 'skills']));
const domainOf = new Map(skills.map((s) => [s.name, s.domain]));
write('candidates.csv', csv(candidates.map((c, i) => ({ id: i + 1, name: c.name, email: c.email, headline: c.headline, location: c.location, experience_years: c.experienceYears, target_career: c.targetCareer, interests: c.interests.join(';'), skills: c.skills.map((s) => `${s.name}:${s.level}`).join(';'), projects: c.projects.map((p) => p.title).join(';'), certifications: c.certifications.map((x) => x.name).join(';') })), ['id', 'name', 'email', 'headline', 'location', 'experience_years', 'target_career', 'interests', 'skills', 'projects', 'certifications']));
write('candidate_skills.csv', csv(candidates.flatMap((c, i) => c.skills.map((s) => ({ candidate_id: i + 1, skill: s.name, domain: domainOf.get(s.name), level: s.level }))), ['candidate_id', 'skill', 'domain', 'level']));

console.log(`skills=${skills.length} careers=${careers.length} interests=${interests.length} ideas=${ideas.length} certs=${certs.length} candidates=${candidates.length}`);
