export const translations = {
  en: {
    store: 'Store',
    editor: 'Editor',
    myApps: 'My Apps',
    profile: 'Profile',
    premium: 'Premium',
    settings: 'Settings',
    help: 'Help',
    syntaxGuide: 'Syntax Guide',
    startTutorial: 'Start Tutorial',
    file: 'File',
    edit: 'Edit',
    newFile: 'New File',
    saveAs: 'Save As',
    loadAs: 'Load As',
    publish: 'Publish to Store',
    saveLocally: 'Save Locally',
    clearCode: 'Clear All Code',
    run: 'Run',
    stop: 'Stop',
    uploadFile: 'Upload File',
    console: 'Console',
    appUi: 'App UI',
    noEntities: 'No entities created yet.',
    ready: 'Ready.',
    error: 'Error',
    programStopped: 'Program stopped.',
    language: 'Language',
    theme: 'Theme',
    dark: 'Dark',
    light: 'Light',
    gettingStarted: 'Getting Started',
    allComponents: 'All Components (Entities)',
    syntaxReference: 'Syntax Reference',
    commonPatterns: 'Common Patterns',
    launchTutorial: 'Launch Interactive Tutorial',
    cancel: 'Cancel',
    appName: 'App Name',
    description: 'Description',
    version: 'Version',
    supportedPlatforms: 'Supported Platforms',
    publishButton: 'Publish to Store',
    publishing: 'Publishing...',
    saveSuccess: 'App saved locally to your account!',
    publishSuccess: 'App published successfully!',
    uploadSuccess: 'Image uploaded!',
    uploadFailed: 'Failed to upload image.',
    copyUrl: 'Copy this URL to use in your EPL code:',
    auth: {
      signIn: 'Sign In',
      signUp: 'Sign Up',
      email: 'Email',
      password: 'Password',
      login: 'Login',
      register: 'Register',
      noAccount: "Don't have an account?",
      hasAccount: 'Already have an account?',
      forgotPassword: 'Forgot Password?',
      googleSignIn: 'Sign In with Google',
      error: 'Authentication error',
      success: 'Success!'
    },
    tutorial: {
      exit: 'Exit Training',
      previous: 'Previous',
      next: 'Continue',
      nextLevel: 'Next Level',
      complete: 'Complete Training',
      level: 'Level',
      step: 'Step',
      of: 'of',
      progress: 'Overall Progress',
      challenge: 'The Challenge:',
      syntaxExample: 'Syntax Example',
      difficulty: {
        beginner: 'Beginner',
        intermediate: 'Intermediate',
        advanced: 'Advanced',
        pro: 'Pro'
      }
    }
  },
  ru: {
    store: 'Магазин',
    editor: 'Редактор',
    myApps: 'Мои приложения',
    profile: 'Профиль',
    premium: 'Премиум',
    settings: 'Настройки',
    help: 'Помощь',
    syntaxGuide: 'Справочник синтаксиса',
    startTutorial: 'Начать обучение',
    file: 'Файл',
    edit: 'Правка',
    newFile: 'Новый файл',
    saveAs: 'Сохранить как',
    loadAs: 'Загрузить',
    publish: 'Опубликовать в магазине',
    saveLocally: 'Сохранить локально',
    clearCode: 'Очистить весь код',
    run: 'Запуск',
    stop: 'Стоп',
    uploadFile: 'Загрузить файл',
    console: 'Консоль',
    appUi: 'Интерфейс',
    noEntities: 'Сущности еще не созданы.',
    ready: 'Готов.',
    error: 'Ошибка',
    programStopped: 'Программа остановлена.',
    language: 'Язык',
    theme: 'Тема',
    dark: 'Темная',
    light: 'Светлая',
    gettingStarted: 'С чего начать',
    allComponents: 'Все компоненты (сущности)',
    syntaxReference: 'Справочник синтаксиса',
    commonPatterns: 'Общие шаблоны',
    launchTutorial: 'Запустить интерактивное обучение',
    cancel: 'Отмена',
    appName: 'Название приложения',
    description: 'Описание',
    version: 'Версия',
    supportedPlatforms: 'Поддерживаемые платформы',
    publishButton: 'Опубликовать в магазине',
    publishing: 'Публикация...',
    saveSuccess: 'Приложение сохранено локально в вашем аккаунте!',
    publishSuccess: 'Приложение успешно опубликовано!',
    uploadSuccess: 'Изображение загружено!',
    uploadFailed: 'Не удалось загрузить изображение.',
    copyUrl: 'Скопируйте этот URL для использования в коде EPL:',
    auth: {
      signIn: 'Войти',
      signUp: 'Регистрация',
      email: 'Email',
      password: 'Пароль',
      login: 'Войти',
      register: 'Зарегистрироваться',
      noAccount: 'Нет аккаунта?',
      hasAccount: 'Уже есть аккаунт?',
      forgotPassword: 'Забыли пароль?',
      googleSignIn: 'Войти через Google',
      error: 'Ошибка аутентификации',
      success: 'Успешно!'
    },
    tutorial: {
      exit: 'Выход',
      previous: 'Назад',
      next: 'Продолжить',
      nextLevel: 'Следующий уровень',
      complete: 'Завершить обучение',
      level: 'Уровень',
      step: 'Шаг',
      of: 'из',
      progress: 'Общий прогресс',
      challenge: 'Задание:',
      syntaxExample: 'Пример синтаксиса',
      difficulty: {
        beginner: 'Новичок',
        intermediate: 'Средний',
        advanced: 'Продвинутый',
        pro: 'Профи'
      }
    }
  }
};

export const tutorialContent = {
  en: [
    {
      title: "Level 1: The Canvas",
      difficulty: "beginner",
      steps: [
        {
          type: 'info',
          title: "The World Entity",
          content: "The 'world' is the foundation of your app. It controls the background and global settings like gravity."
        },
        {
          type: 'how-to',
          title: "Setting Backgrounds",
          content: "Use the 'background' action inside a 'started?' event to change the color.",
          example: "started?\n  background{color=blue}\nend"
        },
        {
          type: 'challenge',
          title: "Level 1 Challenge",
          content: "Now it's your turn! Try to set the background to a dark color.",
          task: "Set the world background to 'black'.",
          answer: "started?\n  background{color=black}\nend"
        }
      ]
    },
    {
      title: "Level 2: Adding Shapes",
      difficulty: "beginner",
      steps: [
        {
          type: 'info',
          title: "Static Entities",
          content: "Entities are the objects in your world. A 'block' is a simple 2D rectangle."
        },
        {
          type: 'how-to',
          title: "Using Create",
          content: "Use the 'create' command followed by the entity type and its settings.",
          example: "started?\n  create block{name=Box, color=red, x=100, y=100}\nend"
        },
        {
          type: 'challenge',
          title: "Level 2 Challenge",
          content: "Add a physical object to your world.",
          task: "Create a blue block named 'Wall' at x=200, y=200.",
          answer: "started?\n  create block{name=Wall, color=blue, x=200, y=200}\nend"
        }
      ]
    },
    {
      title: "Level 3: User Interface",
      difficulty: "beginner",
      steps: [
        {
          type: 'info',
          title: "Buttons",
          content: "Buttons are special entities that users can click to trigger actions."
        },
        {
          type: 'how-to',
          title: "Button Settings",
          content: "Buttons need a 'label' (the text shown) and a 'name' (for code reference).",
          example: "started?\n  create button{name=StartBtn, label=\"Play\", x=50, y=50}\nend"
        },
        {
          type: 'challenge',
          title: "Level 3 Challenge",
          content: "Let's add a UI element.",
          task: "Create a green button named 'Action' with the label 'Go!'.",
          answer: "started?\n  create button{name=Action, label=\"Go!\", color=green, x=100, y=100}\nend"
        }
      ]
    },
    {
      title: "Level 4: Interactivity",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Event Handling",
          content: "Events tell the app when to run code. 'clicked?' is triggered when an entity is pressed."
        },
        {
          type: 'how-to',
          title: "The Clicked Event",
          content: "Specify the 'target' name to listen for clicks on that specific entity.",
          example: "clicked?{target=Action}\n  type{text=\"Button was pressed!\"}\nend"
        },
        {
          type: 'challenge',
          title: "Level 4 Challenge",
          content: "Make your app respond to the user.",
          task: "Make the console say 'Hello' when your 'Action' button is clicked.",
          answer: "clicked?{target=Action}\n  type{text=\"Hello\"}\nend"
        }
      ]
    },
    {
      title: "Level 5: Movement",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Dynamic World",
          content: "The 'move' action changes an entity's position. You can use '+' or '-' for relative movement."
        },
        {
          type: 'how-to',
          title: "Moving Objects",
          content: "Target an entity by name and specify the new x or y coordinates.",
          example: "move{target=Box, x=+10, y=+10}"
        },
        {
          type: 'challenge',
          title: "Level 5 Challenge",
          content: "Create a moving object.",
          task: "Move a block named 'Player' 50 pixels to the right when a button is clicked.",
          answer: "clicked?{target=Action}\n  move{target=Player, x=+50}\nend"
        }
      ]
    },
    {
      title: "Level 6: Variables",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Storing Data",
          content: "Variables store information like scores, health, or names that can change over time."
        },
        {
          type: 'how-to',
          title: "Defining Variables",
          content: "Use the 'variable' command to initialize a value in the 'started?' block.",
          example: "started?\n  variable{name=Score, value=0}\nend"
        },
        {
          type: 'challenge',
          title: "Level 6 Challenge",
          content: "Initialize your app state.",
          task: "Create a variable named 'Health' with an initial value of 100.",
          answer: "started?\n  variable{name=Health, value=100}\nend"
        }
      ]
    },
    {
      title: "Level 7: Math & Logic",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Calculations",
          content: "The 'math' action lets you add, subtract, multiply, or divide your variables."
        },
        {
          type: 'how-to',
          title: "Updating Scores",
          content: "Target a variable and choose an operation like 'add'.",
          example: "math{target=Score, op=add, value=1}\ntype{text=Score}"
        },
        {
          type: 'challenge',
          title: "Level 7 Challenge",
          content: "Implement a scoring system.",
          task: "Add 10 to a 'Score' variable every time a button is clicked.",
          answer: "clicked?{target=Action}\n  math{target=Score, op=add, value=10}\nend"
        }
      ]
    },
    {
      title: "Level 8: Conditions",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Decision Making",
          content: "Use 'if' blocks to only run code when certain conditions are met."
        },
        {
          type: 'how-to',
          title: "Using Compare",
          content: "The 'compare' command checks values inside an 'if' block.",
          example: "if\n  compare{a=Score, op=\">\", b=100}\n  type{text=\"High Score!\"}\nend"
        },
        {
          type: 'challenge',
          title: "Level 8 Challenge",
          content: "Create a win condition.",
          task: "Display 'Game Over' if the 'Health' variable reaches 0.",
          answer: "forever?\n  if\n    compare{a=Health, op=\"==\", b=0}\n    type{text=\"Game Over\"}\n  end\nend"
        }
      ]
    },
    {
      title: "Level 9: Timers",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Time Events",
          content: "Timers trigger code at regular intervals (measured in milliseconds)."
        },
        {
          type: 'how-to',
          title: "Creating Timers",
          content: "Create a timer and listen for the 'timer_tick?' event.",
          example: "started?\n  create timer{name=Clock, interval=1000}\nend\n\ntimer_tick?{name=Clock}\n  type{text=\"Tick!\"}\nend"
        },
        {
          type: 'challenge',
          title: "Level 9 Challenge",
          content: "Add a time-based mechanic.",
          task: "Make a block move automatically every 500 milliseconds.",
          answer: "started?\n  create timer{name=Clock, interval=500}\nend\n\ntimer_tick?{name=Clock}\n  move{target=Box, x=+10}\nend"
        }
      ]
    },
    {
      title: "Level 10: AI Power",
      difficulty: "pro",
      steps: [
        {
          type: 'info',
          title: "Gemini Integration",
          content: "The 'ai' command uses Gemini to generate content or logic dynamically."
        },
        {
          type: 'how-to',
          title: "AI Actions",
          content: "You can prompt the AI to generate text for a label or console.",
          example: "ai{prompt=\"Tell a joke\", target=Label}"
        },
        {
          type: 'challenge',
          title: "Level 10 Challenge",
          content: "Use the power of AI.",
          task: "Generate a random quest description when a button is clicked.",
          answer: "clicked?{target=Action}\n  ai{prompt=\"Generate a random quest description\", target=console}\nend"
        }
      ]
    },
    {
      title: "Level 11: Sprites & Images",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Visual Assets",
          content: "Sprites are images that can represent characters or items. You can also use 'png' for static images."
        },
        {
          type: 'how-to',
          title: "Creating Sprites",
          content: "Use a URL or a keyword for the image property.",
          example: "create sprite{name=Hero, image=\"hero_idle\", x=100, y=100}"
        },
        {
          type: 'challenge',
          title: "Level 11 Challenge",
          content: "Add a character to your app.",
          task: "Create a sprite named 'Ghost' with an image URL."
        }
      ]
    },
    {
      title: "Level 12: Sound Effects",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Audio Feedback",
          content: "Sounds make your app more immersive. You first create a sound entity, then play it."
        },
        {
          type: 'how-to',
          title: "Playing Audio",
          content: "Use 'play_sound' and target the name of your sound entity.",
          example: "started?\n  create sound{name=Ding, file=\"ding.mp3\"}\nend\n\nclicked?{target=Btn}\n  play_sound{sound=Ding}\nend"
        },
        {
          type: 'challenge',
          title: "Level 12 Challenge",
          content: "Add sound effects.",
          task: "Play a sound named 'Click' when a button is pressed."
        }
      ]
    },
    {
      title: "Level 13: Scoped Actions",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "The Object Block",
          content: "The 'object' command lets you group multiple actions for a single entity without repeating its name."
        },
        {
          type: 'how-to',
          title: "Grouping Actions",
          content: "Everything inside the object block applies to the target.",
          example: "object{name=Box}\n  move{x=+10}\n  rotate{degrees=45}\n  scale{factor=1.2}\nend"
        },
        {
          type: 'challenge',
          title: "Level 13 Challenge",
          content: "Modify an object in multiple ways.",
          task: "Use an object block to move and rotate a block named 'Coin' at the same time."
        }
      ]
    },
    {
      title: "Level 14: Collisions",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Physical Interaction",
          content: "The 'collided?' event triggers when two entities overlap in the world."
        },
        {
          type: 'how-to',
          title: "Handling Collisions",
          content: "You can check if a specific entity collided with anything.",
          example: "collided?{target=Player}\n  type{text=\"Ouch!\"}\n  destroy{target=Enemy}\nend"
        },
        {
          type: 'challenge',
          title: "Level 14 Challenge",
          content: "Create a simple interaction.",
          task: "Destroy a 'Coin' entity when the 'Player' collides with it."
        }
      ]
    },
    {
      title: "Level 15: Player Controls",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Built-in Movement",
          content: "EPL has built-in control modes for common game mechanics like WASD movement."
        },
        {
          type: 'how-to',
          title: "Enabling WASD",
          content: "Use the 'control' action to enable movement for the 'player' entity.",
          example: "started?\n  create player{name=Hero, x=100, y=100}\n  control{type=wasd}\nend"
        },
        {
          type: 'challenge',
          title: "Level 15 Challenge",
          content: "Make a controllable character.",
          task: "Create a player and enable WASD controls."
        }
      ]
    },
    {
      title: "Level 16: Particles",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Visual Juice",
          content: "Particles add 'juice' to your app with effects like fire, smoke, or explosions."
        },
        {
          type: 'how-to',
          title: "Spawning Particles",
          content: "Create a particle entity at a specific location.",
          example: "clicked?{target=Bomb}\n  create particle{type=explosion, x=100, y=100, count=20}\nend"
        },
        {
          type: 'challenge',
          title: "Level 16 Challenge",
          content: "Add visual effects.",
          task: "Spawn 'fire' particles when a button is clicked."
        }
      ]
    },
    {
      title: "Level 17: Text Input",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "User Input",
          content: "The 'textbox' entity allows users to type text into your application."
        },
        {
          type: 'how-to',
          title: "Reading Input",
          content: "The 'writed?' event triggers when the user finishes typing.",
          example: "started?\n  create textbox{name=Input, x=10, y=10}\nend\n\nwrited?{target=Input}\n  type{text=Input.text}\nend"
        },
        {
          type: 'challenge',
          title: "Level 17 Challenge",
          content: "Get user feedback.",
          task: "Create a textbox and print its content to the console when the user types."
        }
      ]
    },
    {
      title: "Level 18: Advanced Logic",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "The Else Block",
          content: "Use 'else' to run code when an 'if' condition is NOT met."
        },
        {
          type: 'how-to',
          title: "If-Else Syntax",
          content: "Place 'else' before the 'end' of an 'if' block.",
          example: "if\n  compare{a=Score, op=\">\", b=10}\n  type{text=\"Winner\"}\nelse\n  type{text=\"Keep trying\"}\nend"
        },
        {
          type: 'challenge',
          title: "Level 18 Challenge",
          content: "Create a branching path.",
          task: "Check if 'Health' is greater than 50: if yes, move fast; otherwise, move slow."
        }
      ]
    },
    {
      title: "Level 19: Loops",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Repeating Code",
          content: "The 'repeat' command runs a block of code multiple times instantly."
        },
        {
          type: 'how-to',
          title: "Using Repeat",
          content: "Specify how many times to repeat the block.",
          example: "repeat{times=5}\n  create block{color=random, x=random, y=random}\nend"
        },
        {
          type: 'challenge',
          title: "Level 19 Challenge",
          content: "Generate many objects.",
          task: "Use a loop to create 10 small blocks at random positions."
        }
      ]
    },
    {
      title: "Level 20: 3D Graphics",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Adding Depth",
          content: "The '3Dblock' entity adds a third dimension to your world. It has width, height, and depth."
        },
        {
          type: 'how-to',
          title: "Creating 3D Blocks",
          content: "You can set the depth and even rotate it in 3D space.",
          example: "create 3Dblock{name=Cube, color=blue, x=100, y=100, depth=50}"
        },
        {
          type: 'challenge',
          title: "Level 20 Challenge",
          content: "Add a 3D object.",
          task: "Create a red 3Dblock named 'Box3D' with a depth of 100."
        }
      ]
    },
    {
      title: "Level 21: Text Labels",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Static Text",
          content: "The 'text_label' entity is used to display text that doesn't need to be clicked."
        },
        {
          type: 'how-to',
          title: "Using Labels",
          content: "Set the 'text' property to what you want to show.",
          example: "create text_label{name=Title, text=\"Welcome to my Game\", x=50, y=20}"
        },
        {
          type: 'challenge',
          title: "Level 21 Challenge",
          content: "Add a title to your app.",
          task: "Create a text_label named 'Header' that says 'EPL Studio'."
        }
      ]
    },
    {
      title: "Level 22: Geometric Shapes",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Circles and Lines",
          content: "You can create more than just blocks. 'circle' and 'line' are also available."
        },
        {
          type: 'how-to',
          title: "Drawing Shapes",
          content: "Circles need a 'radius', and lines need 'x2' and 'y2' for the end point.",
          example: "create circle{name=Ball, radius=20, color=yellow, x=100, y=100}\ncreate line{name=Floor, x=0, y=200, x2=400, y2=200, color=white}"
        },
        {
          type: 'challenge',
          title: "Level 22 Challenge",
          content: "Draw a simple scene.",
          task: "Create a white circle named 'Sun' with a radius of 50."
        }
      ]
    },
    {
      title: "Level 23: Constant Updates",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "The Forever Loop",
          content: "The 'forever?' event runs every single frame. It's perfect for smooth animations or constant checks."
        },
        {
          type: 'how-to',
          title: "Using Forever",
          content: "Be careful! Code inside forever runs very fast.",
          example: "forever?\n  move{target=Ball, x=+1}\nend"
        },
        {
          type: 'challenge',
          title: "Level 23 Challenge",
          content: "Create a constant animation.",
          task: "Use a forever loop to make a block named 'Spinner' rotate by 5 degrees every frame."
        }
      ]
    },
    {
      title: "Level 24: The Masterpiece",
      difficulty: "pro",
      steps: [
        {
          type: 'info',
          title: "Final Challenge",
          content: "You've learned about all components! Now it's time to combine your skills into a real mini-game."
        },
        {
          type: 'how-to',
          title: "Game Architecture",
          content: "Combine variables for score, timers for spawning, and collisions for gameplay.",
          example: "# Try to build a clicker game or a simple dodger!"
        },
        {
          type: 'challenge',
          title: "The Grand Finale",
          content: "Build a complete mini-game with a score, movement, and a win/loss condition.",
          task: "Create a game where clicking a moving target increases your score."
        }
      ]
    },
    {
      title: "Level 25: Advanced AI",
      difficulty: "pro",
      steps: [
        {
          type: 'info',
          title: "AI Logic",
          content: "You can use AI to make decisions for your entities."
        },
        {
          type: 'how-to',
          title: "AI Decision",
          content: "Use 'ai' with a prompt to decide what an entity should do.",
          example: "forever?\n  ai{prompt=\"Should the enemy move left or right?\", target=Enemy}\nend"
        },
        {
          type: 'challenge',
          title: "Level 25 Challenge",
          content: "Make a smart enemy.",
          task: "Use AI to decide the movement of an enemy block."
        }
      ]
    },
    {
      title: "Level 26: Cursor & Movement",
      difficulty: "beginner",
      steps: [
        {
          type: 'info',
          title: "Custom Cursors",
          content: "You can change the mouse cursor to any image to customize your app's feel."
        },
        {
          type: 'how-to',
          title: "Using Cursor",
          content: "Use the 'cursor' action with an image URL.",
          example: "started?\n  cursor{image=\"my_cursor.png\"}\nend"
        },
        {
          type: 'info',
          title: "Precise Movement",
          content: "The 'move_to' action moves an entity to specific x, y coordinates."
        },
        {
          type: 'how-to',
          title: "Using Move To",
          content: "Target an entity and set its new position.",
          example: "move_to{target=Player, x=500, y=500}"
        },
        {
          type: 'challenge',
          title: "Level 26 Challenge",
          content: "Customize and move!",
          task: "Change the cursor to 'pointer.png' and move the 'Player' to x=100, y=100."
        }
      ]
    },
    {
      title: "Level 27: File Control",
      difficulty: "beginner",
      steps: [
        {
          type: 'info',
          title: "File Upload",
          content: "You can now upload not just images, but any files to your app."
        },
        {
          type: 'how-to',
          title: "Upload File Button",
          content: "Use the 'Upload File' button in the toolbar to add a file to storage."
        },
        {
          type: 'info',
          title: "Image Control",
          content: "The 'Edit' tab now has 'Image Control'. Here you can view all your uploaded files, copy their URLs, and manage them."
        },
        {
          type: 'challenge',
          title: "Level 27 Challenge",
          content: "Try uploading a file and copying its URL.",
          task: "Upload any file via the 'Upload File' button, open 'Image Control', and copy the URL of the uploaded file."
        }
      ]
    }
  ],
  ru: [
    {
      title: "Уровень 1: Холст",
      difficulty: "beginner",
      steps: [
        {
          type: 'info',
          title: "Сущность World",
          content: "'world' (мир) — это основа вашего приложения. Он управляет фоном и глобальными настройками, такими как гравитация."
        },
        {
          type: 'how-to',
          title: "Настройка фона",
          content: "Используйте действие 'background' внутри события 'started?', чтобы изменить цвет.",
          example: "started?\n  background{color=blue}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 1 уровня",
          content: "Теперь ваша очередь! Попробуйте установить темный фон.",
          task: "Установите фон мира на 'black' (черный).",
          answer: "started?\n  background{color=black}\nend"
        }
      ]
    },
    {
      title: "Уровень 2: Добавление фигур",
      difficulty: "beginner",
      steps: [
        {
          type: 'info',
          title: "Статические сущности",
          content: "Сущности — это объекты в вашем мире. 'block' (блок) — это простой 2D-прямоугольник."
        },
        {
          type: 'how-to',
          title: "Использование Create",
          content: "Используйте команду 'create', а затем тип сущности и ее настройки.",
          example: "started?\n  create block{name=Box, color=red, x=100, y=100}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 2 уровня",
          content: "Добавьте физический объект в свой мир.",
          task: "Создайте синий блок с именем 'Wall' в координатах x=200, y=200.",
          answer: "started?\n  create block{name=Wall, color=blue, x=200, y=200}\nend"
        }
      ]
    },
    {
      title: "Уровень 3: Пользовательский интерфейс",
      difficulty: "beginner",
      steps: [
        {
          type: 'info',
          title: "Кнопки",
          content: "Кнопки — это специальные сущности, на которые пользователи могут нажимать для запуска действий."
        },
        {
          type: 'how-to',
          title: "Настройки кнопок",
          content: "Кнопкам нужен 'label' (текст на кнопке) и 'name' (имя для ссылки в коде).",
          example: "started?\n  create button{name=StartBtn, label=\"Play\", x=50, y=50}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 3 уровня",
          content: "Давайте добавим элемент интерфейса.",
          task: "Создайте зеленую кнопку с именем 'Action' и текстом 'Go!'.",
          answer: "started?\n  create button{name=Action, label=\"Go!\", color=green, x=100, y=100}\nend"
        }
      ]
    },
    {
      title: "Уровень 4: Интерактивность",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Обработка событий",
          content: "События говорят приложению, когда запускать код. 'clicked?' срабатывает при нажатии на сущность."
        },
        {
          type: 'how-to',
          title: "Событие Clicked",
          content: "Укажите имя 'target' (цель), чтобы слушать нажатия на конкретную сущность.",
          example: "clicked?{target=Action}\n  type{text=\"Кнопка нажата!\"}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 4 уровня",
          content: "Сделайте так, чтобы ваше приложение отвечало пользователю.",
          task: "Сделайте так, чтобы в консоли появлялось 'Hello', когда нажата кнопка 'Action'.",
          answer: "clicked?{target=Action}\n  type{text=\"Hello\"}\nend"
        }
      ]
    },
    {
      title: "Уровень 5: Движение",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Динамичный мир",
          content: "Действие 'move' изменяет положение сущности. Вы можете использовать '+' или '-' для относительного движения."
        },
        {
          type: 'how-to',
          title: "Перемещение объектов",
          content: "Укажите имя сущности и новые координаты x или y.",
          example: "move{target=Box, x=+10, y=+10}"
        },
        {
          type: 'challenge',
          title: "Задание 5 уровня",
          content: "Создайте движущийся объект.",
          task: "Переместите блок с именем 'Player' на 50 пикселей вправо при нажатии кнопки.",
          answer: "clicked?{target=Action}\n  move{target=Player, x=+50}\nend"
        }
      ]
    },
    {
      title: "Уровень 6: Переменные",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Хранение данных",
          content: "Переменные хранят информацию, такую как очки, здоровье или имена, которая может меняться со временем."
        },
        {
          type: 'how-to',
          title: "Определение переменных",
          content: "Используйте команду 'variable', чтобы задать начальное значение в блоке 'started?'.",
          example: "started?\n  variable{name=Score, value=0}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 6 уровня",
          content: "Инициализируйте состояние приложения.",
          task: "Создайте переменную с именем 'Health' с начальным значением 100.",
          answer: "started?\n  variable{name=Health, value=100}\nend"
        }
      ]
    },
    {
      title: "Уровень 7: Математика и логика",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Вычисления",
          content: "Действие 'math' позволяет складывать, вычитать, умножать или делить ваши переменные."
        },
        {
          type: 'how-to',
          title: "Обновление очков",
          content: "Укажите переменную и выберите операцию, например 'add' (сложение).",
          example: "math{target=Score, op=add, value=1}\ntype{text=Score}"
        },
        {
          type: 'challenge',
          title: "Задание 7 уровня",
          content: "Реализуйте систему начисления очков.",
          task: "Прибавляйте 10 к переменной 'Score' каждый раз при нажатии кнопки.",
          answer: "clicked?{target=Action}\n  math{target=Score, op=add, value=10}\nend"
        }
      ]
    },
    {
      title: "Уровень 8: Условия",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Принятие решений",
          content: "Используйте блоки 'if', чтобы запускать код только при выполнении определенных условий."
        },
        {
          type: 'how-to',
          title: "Использование Compare",
          content: "Команда 'compare' проверяет значения внутри блока 'if'.",
          example: "if\n  compare{a=Score, op=\">\", b=100}\n  type{text=\"Рекорд!\"}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 8 уровня",
          content: "Создайте условие победы.",
          task: "Выведите 'Game Over', если переменная 'Health' станет равна 0.",
          answer: "forever?\n  if\n    compare{a=Health, op=\"==\", b=0}\n    type{text=\"Game Over\"}\n  end\nend"
        }
      ]
    },
    {
      title: "Уровень 9: Таймеры",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "События времени",
          content: "Таймеры запускают код через регулярные промежутки времени (измеряются в миллисекундах)."
        },
        {
          type: 'how-to',
          title: "Создание таймеров",
          content: "Создайте таймер и слушайте событие 'timer_tick?'.",
          example: "started?\n  create timer{name=Clock, interval=1000}\nend\n\ntimer_tick?{name=Clock}\n  type{text=\"Тик!\"}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 9 уровня",
          content: "Добавьте механику, основанную на времени.",
          task: "Сделайте так, чтобы блок двигался автоматически каждые 500 миллисекунд.",
          answer: "started?\n  create timer{name=Clock, interval=500}\nend\n\ntimer_tick?{name=Clock}\n  move{target=Box, x=+10}\nend"
        }
      ]
    },
    {
      title: "Уровень 10: Сила ИИ",
      difficulty: "pro",
      steps: [
        {
          type: 'info',
          title: "Интеграция Gemini",
          content: "Команда 'ai' использует Gemini для динамической генерации контента или логики."
        },
        {
          type: 'how-to',
          title: "Действия ИИ",
          content: "Вы можете попросить ИИ сгенерировать текст для надписи или консоли.",
          example: "ai{prompt=\"Расскажи шутку\", target=Label}"
        },
        {
          type: 'challenge',
          title: "Задание 10 уровня",
          content: "Используйте мощь ИИ.",
          task: "Генерируйте случайное описание квеста при нажатии кнопки.",
          answer: "clicked?{target=Action}\n  ai{prompt=\"Generate a random quest description\", target=console}\nend"
        }
      ]
    },
    {
      title: "Уровень 11: Спрайты и изображения",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Визуальные ресурсы",
          content: "Спрайты — это изображения, которые могут представлять персонажей или предметы. Вы также можете использовать 'png' для статических картинок."
        },
        {
          type: 'how-to',
          title: "Создание спрайтов",
          content: "Используйте URL или ключевое слово для свойства image.",
          example: "create sprite{name=Hero, image=\"hero_idle\", x=100, y=100}"
        },
        {
          type: 'challenge',
          title: "Задание 11 уровня",
          content: "Добавьте персонажа в свое приложение.",
          task: "Создайте спрайт с именем 'Ghost' (Призрак) с использованием URL изображения.",
          answer: "started?\n  create sprite{name=Ghost, image=\"https://picsum.photos/seed/ghost/100/100\", x=100, y=100}\nend"
        }
      ]
    },
    {
      title: "Уровень 12: Звуковые эффекты",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Аудио-отклик",
          content: "Звуки делают ваше приложение более живым. Сначала вы создаете сущность sound, а затем воспроизводите ее."
        },
        {
          type: 'how-to',
          title: "Воспроизведение аудио",
          content: "Используйте 'play_sound' и укажите имя вашей сущности sound.",
          example: "started?\n  create sound{name=Ding, file=\"ding.mp3\"}\nend\n\nclicked?{target=Btn}\n  play_sound{sound=Ding}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 12 уровня",
          content: "Добавьте звуковые эффекты.",
          task: "Воспроизведите звук с именем 'Click', когда нажата кнопка.",
          answer: "clicked?{target=Action}\n  play_sound{sound=Click}\nend"
        }
      ]
    },
    {
      title: "Уровень 13: Сгруппированные действия",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Блок Object",
          content: "Команда 'object' позволяет сгруппировать несколько действий для одной сущности, не повторяя ее имя."
        },
        {
          type: 'how-to',
          title: "Группировка действий",
          content: "Все внутри блока object применяется к цели.",
          example: "object{name=Box}\n  move{x=+10}\n  rotate{degrees=45}\n  scale{factor=1.2}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 13 уровня",
          content: "Измените объект несколькими способами.",
          task: "Используйте блок object, чтобы одновременно переместить и повернуть блок с именем 'Coin'."
        }
      ]
    },
    {
      title: "Уровень 14: Столкновения",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Физическое взаимодействие",
          content: "Событие 'collided?' срабатывает, когда две сущности перекрываются в мире."
        },
        {
          type: 'how-to',
          title: "Обработка столкновений",
          content: "Вы можете проверить, столкнулась ли конкретная сущность с чем-либо.",
          example: "collided?{target=Player}\n  type{text=\"Ой!\"}\n  destroy{target=Enemy}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 14 уровня",
          content: "Создайте простое взаимодействие.",
          task: "Уничтожьте сущность 'Coin', когда 'Player' сталкивается с ней."
        }
      ]
    },
    {
      title: "Уровень 15: Управление игроком",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Встроенное движение",
          content: "В EPL есть встроенные режимы управления для общих игровых механик, таких как движение WASD."
        },
        {
          type: 'how-to',
          title: "Включение WASD",
          content: "Используйте действие 'control', чтобы включить движение для сущности 'player'.",
          example: "started?\n  create player{name=Hero, x=100, y=100}\n  control{type=wasd}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 15 уровня",
          content: "Создайте управляемого персонажа.",
          task: "Создайте игрока и включите управление WASD."
        }
      ]
    },
    {
      title: "Уровень 16: Частицы",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Визуальные эффекты",
          content: "Частицы добавляют 'сочности' вашему приложению с помощью таких эффектов, как огонь, дым или взрывы."
        },
        {
          type: 'how-to',
          title: "Создание частиц",
          content: "Создайте сущность particle в определенном месте.",
          example: "clicked?{target=Bomb}\n  create particle{type=explosion, x=100, y=100, count=20}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 16 уровня",
          content: "Добавьте визуальные эффекты.",
          task: "Создайте частицы 'fire' (огонь) при нажатии кнопки."
        }
      ]
    },
    {
      title: "Уровень 17: Текстовый ввод",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Ввод пользователя",
          content: "Сущность 'textbox' позволяет пользователям вводить текст в ваше приложение."
        },
        {
          type: 'how-to',
          title: "Чтение ввода",
          content: "Событие 'writed?' срабатывает, когда пользователь заканчивает ввод.",
          example: "started?\n  create textbox{name=Input, x=10, y=10}\nend\n\nwrited?{target=Input}\n  type{text=Input.text}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 17 уровня",
          content: "Получите отзыв пользователя.",
          task: "Создайте текстовое поле и выведите его содержимое в консоль, когда пользователь что-то вводит."
        }
      ]
    },
    {
      title: "Уровень 18: Продвинутая логика",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Блок Else",
          content: "Используйте 'else' (иначе), чтобы запустить код, когда условие 'if' НЕ выполняется."
        },
        {
          type: 'how-to',
          title: "Синтаксис If-Else",
          content: "Поместите 'else' перед 'end' в блоке 'if'.",
          example: "if\n  compare{a=Score, op=\">\", b=10}\n  type{text=\"Победитель\"}\nelse\n  type{text=\"Попробуй еще раз\"}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 18 уровня",
          content: "Создайте разветвление.",
          task: "Проверьте, больше ли 'Health' 50: если да, двигайтесь быстро; иначе — медленно."
        }
      ]
    },
    {
      title: "Уровень 19: Циклы",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Повторение кода",
          content: "Команда 'repeat' мгновенно запускает блок кода несколько раз."
        },
        {
          type: 'how-to',
          title: "Использование Repeat",
          content: "Укажите, сколько раз нужно повторить блок.",
          example: "repeat{times=5}\n  create block{color=random, x=random, y=random}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 19 уровня",
          content: "Сгенерируйте много объектов.",
          task: "Используйте цикл, чтобы создать 10 маленьких блоков в случайных позициях."
        }
      ]
    },
    {
      title: "Уровень 20: 3D Графика",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Добавление глубины",
          content: "Сущность '3Dblock' добавляет третье измерение в ваш мир. У него есть ширина, высота и глубина."
        },
        {
          type: 'how-to',
          title: "Создание 3D блоков",
          content: "Вы можете установить глубину и даже вращать его в 3D пространстве.",
          example: "create 3Dblock{name=Cube, color=blue, x=100, y=100, depth=50}"
        },
        {
          type: 'challenge',
          title: "Задание 20 уровня",
          content: "Добавьте 3D объект.",
          task: "Создайте красный 3Dblock с именем 'Box3D' и глубиной 100."
        }
      ]
    },
    {
      title: "Уровень 21: Текстовые метки",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Статический текст",
          content: "Сущность 'text_label' используется для отображения текста, на который не нужно нажимать."
        },
        {
          type: 'how-to',
          title: "Использование меток",
          content: "Установите свойство 'text' на то, что вы хотите показать.",
          example: "create text_label{name=Title, text=\"Добро пожаловать в мою игру\", x=50, y=20}"
        },
        {
          type: 'challenge',
          title: "Задание 21 уровня",
          content: "Добавьте заголовок в ваше приложение.",
          task: "Создайте text_label с именем 'Header', который говорит 'EPL Studio'."
        }
      ]
    },
    {
      title: "Уровень 22: Геометрические фигуры",
      difficulty: "intermediate",
      steps: [
        {
          type: 'info',
          title: "Круги и линии",
          content: "Вы можете создавать не только блоки. Также доступны 'circle' и 'line'."
        },
        {
          type: 'how-to',
          title: "Рисование фигур",
          content: "Кругам нужен 'radius', а линиям — 'x2' и 'y2' для конечной точки.",
          example: "create circle{name=Ball, radius=20, color=yellow, x=100, y=100}\ncreate line{name=Floor, x=0, y=200, x2=400, y2=200, color=white}"
        },
        {
          type: 'challenge',
          title: "Задание 22 уровня",
          content: "Нарисуйте простую сцену.",
          task: "Создайте белый круг с именем 'Sun' и радиусом 50."
        }
      ]
    },
    {
      title: "Уровень 23: Постоянные обновления",
      difficulty: "advanced",
      steps: [
        {
          type: 'info',
          title: "Цикл Forever",
          content: "Событие 'forever?' запускается каждый кадр. Оно идеально подходит для плавной анимации или постоянных проверок."
        },
        {
          type: 'how-to',
          title: "Использование Forever",
          content: "Будьте осторожны! Код внутри forever выполняется очень быстро.",
          example: "forever?\n  move{target=Ball, x=+1}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 23 уровня",
          content: "Создайте постоянную анимацию.",
          task: "Используйте цикл forever, чтобы заставить блок с именем 'Spinner' вращаться на 5 градусов каждый кадр."
        }
      ]
    },
    {
      title: "Уровень 24: Шедевр",
      difficulty: "pro",
      steps: [
        {
          type: 'info',
          title: "Финальное испытание",
          content: "Вы узнали обо всех компонентах! Теперь пришло время объединить ваши навыки в настоящую мини-игру."
        },
        {
          type: 'how-to',
          title: "Архитектура игры",
          content: "Комбинируйте переменные для счета, таймеры для спавна и коллизии для геймплея.",
          example: "# Попробуйте создать игру-кликер или простой доджер!"
        },
        {
          type: 'challenge',
          title: "Гранд-финал",
          content: "Создайте полноценную мини-игру со счетом, движением и условием победы/поражения.",
          task: "Создайте игру, где нажатие на движущуюся цель увеличивает ваш счет."
        }
      ]
    },
    {
      title: "Уровень 25: Продвинутый ИИ",
      difficulty: "pro",
      steps: [
        {
          type: 'info',
          title: "Логика ИИ",
          content: "Вы можете использовать ИИ для принятия решений вашими сущностями."
        },
        {
          type: 'how-to',
          title: "Решения ИИ",
          content: "Используйте 'ai' с промптом, чтобы решить, что должна делать сущность.",
          example: "forever?\n  ai{prompt=\"Должен ли враг двигаться влево или вправо?\", target=Enemy}\nend"
        },
        {
          type: 'challenge',
          title: "Задание 25 уровня",
          content: "Сделайте умного врага.",
          task: "Используйте ИИ, чтобы решить движение блока врага."
        }
      ]
    },
    {
      title: "Уровень 26: Курсор и движение",
      difficulty: "beginner",
      steps: [
        {
          type: 'info',
          title: "Пользовательские курсоры",
          content: "Вы можете изменить курсор мыши на любое изображение, чтобы настроить вид вашего приложения."
        },
        {
          type: 'how-to',
          title: "Использование Cursor",
          content: "Используйте действие 'cursor' с URL изображения.",
          example: "started?\n  cursor{image=\"my_cursor.png\"}\nend"
        },
        {
          type: 'info',
          title: "Точное движение",
          content: "Действие 'move_to' перемещает сущность в конкретные координаты x, y."
        },
        {
          type: 'how-to',
          title: "Использование Move To",
          content: "Выберите сущность и установите ее новую позицию.",
          example: "move_to{target=Player, x=500, y=500}"
        },
        {
          type: 'challenge',
          title: "Задание 26 уровня",
          content: "Настройте и переместите!",
          task: "Измените курсор на 'pointer.png' и переместите 'Player' в x=100, y=100."
        }
      ]
    },
    {
      title: "Уровень 27: Управление файлами",
      difficulty: "beginner",
      steps: [
        {
          type: 'info',
          title: "Загрузка файлов",
          content: "Теперь вы можете загружать не только изображения, но и любые другие файлы в ваше приложение."
        },
        {
          type: 'how-to',
          title: "Кнопка 'Загрузить файл'",
          content: "Используйте кнопку 'Загрузить файл' в панели инструментов, чтобы добавить файл в хранилище."
        },
        {
          type: 'info',
          title: "Image Control",
          content: "Вкладка 'Edit' теперь содержит 'Image Control'. Здесь вы можете просматривать список всех ваших загруженных файлов, копировать их URL и управлять ими."
        },
        {
          type: 'challenge',
          title: "Задание 27 уровня",
          content: "Попробуйте загрузить файл и скопировать его URL.",
          task: "Загрузите любой файл через кнопку 'Загрузить файл', откройте 'Image Control' и скопируйте URL загруженного файла."
        }
      ]
    }
  ]
};
