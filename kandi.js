(function ($) {
  // define variables
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var volume, player, score, stop, ticker;
  var platforms = [], water = [], enemies = [], environment = [];
  var canUseLocalStorage = 'localStorage' in window && window.localStorage !== null;
  ctx.font = "15pt Arial";

  // platform variables
  var platformHeight, platformLength, gapLength;
  var platformWidth = 32;
  var platformBase = canvas.height - platformWidth;
  var platformSpacer = 64;

  // set the sound preference
  if (canUseLocalStorage) {
    var playSound = (localStorage['game.playSound'] == true);

    if (playSound) {
      volume = 1;
      $('.sound').addClass('sound-on').removeClass('sound-off');
    }
    else {
      volume = 0;
      $('.sound').addClass('sound-off').removeClass('sound-on');
    }
  }

  /**
   * Asset pre-loader object. Loads all images and sounds
   */
  var assetLoader = (function() {
    // images
    this.imgs        = {
      'bg'            : 'imgs/bg.png',
      'sky'           : 'imgs/sky.png',
      'backdrop'      : 'imgs/backdrop.png',
      'backdrop2'     : 'imgs/backdrop_ground.png',
      'water'         : 'imgs/water.png',
      'grass1'        : 'imgs/grassMid1.png',
      'grass2'        : 'imgs/grassMid2.png',
      'avatar_normal' : 'imgs/normal_walk.png',
      'bridge'        : 'imgs/bridge.png',
      'plant'         : 'imgs/plant.png',
      'bush1'         : 'imgs/bush1.png',
      'bush2'         : 'imgs/bush2.png',
      'cliff'         : 'imgs/grassCliffRight.png',
      'spikes'        : 'imgs/spikes.png',
      'grass'         : 'imgs/grass.png',
      'box'           : 'imgs/boxCoin.png',
      'slime'         : 'imgs/slime.png'
    };

    // sounds
    this.sounds      = {
      'bg'            : 'sounds/bg.mp3',
      'jump'          : 'sounds/jump.mp3',
      'gameOver'      : 'sounds/gameOver.mp3'
    };

    var assetsLoaded = 0;                                // how many assets have been loaded
    var numImgs      = Object.keys(this.imgs).length;    // total number of image assets
    var numSounds    = Object.keys(this.sounds).length;  // total number of sound assets
    this.totalAssest = numImgs + numSounds;              // total number of assets
    this.checkAudio  = {};                               // setInterval variable for checking audio loading

    /**
     * Ensure all assets are loaded before using them
     * @param self Reference to the assetLoader object
     */
    function assetLoaded(self, dic, name) {
      assetsLoaded++;
      self[dic][name].status = 'loaded';
      assetProgress(assetsLoaded, self.totalAssest);
      if (assetsLoaded === self.totalAssest) {
        clearInterval(self.checkAudio);
        mainMenu();
      }
    }

    /**
     * Check the status of all sound files for being loaded
     * Workaround of audio API not firing events when loaded
     */
    function checkAudioStatus() {
      for (var sound in this.sounds) {
        if (this.sounds.hasOwnProperty(sound) && this.sounds[sound].status === 'loading' && this.sounds[sound].readyState === 4) {
          assetLoaded(this, 'sounds', sound);
        }
      }
    }

    // create asset, set callback for asset loading, set asset source
    var self = this;
    var src  = '';
    for (var img in this.imgs) {
      if (this.imgs.hasOwnProperty(img)) {
        src = this.imgs[img];
        this.imgs[img] = new Image();
        this.imgs[img].status = 'loading';
        this.imgs[img].onload = function() { assetLoaded(self, 'imgs', img); };
        this.imgs[img].src = src;
      }
    }
    for (var sound in this.sounds) {
      if (this.sounds.hasOwnProperty(sound)) {
        src = this.sounds[sound];
        this.sounds[sound] = new Audio();
        this.sounds[sound].status = 'loading';
        this.sounds[sound].volume = volume;
        this.sounds[sound].src = src;
      }
    }

    var that = this;
    if (numSounds > 0) {
      this.checkAudio = setInterval(function() { checkAudioStatus.call(that); },1000);
    }

    return {
      imgs: this.imgs,
      sounds: this.sounds,
      totalAssest: this.totalAssest
    };
  })();

  /**
   * Creates a Spritesheet
   * @param {string} - Path to the image.
   * @param {number} - Width (in px) of each frame.
   * @param {number} - Height (in px) of each frame.
   */
  function SpriteSheet(path, frameWidth, frameHeight) {
    this.image = new Image();
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;

    // calculate the number of frames in a row after the image loads
    var self = this;
    this.image.onload = function() {
      self.framesPerRow = Math.floor(self.image.width / self.frameWidth);
    };

    this.image.src = path;
  }

  /**
   * Creates an animation from a spritesheet.
   * @param {SpriteSheet} - The spritesheet used to create the animation.
   * @param {number}      - Number of frames to wait for before transitioning the animation.
   * @param {array}       - Range or sequence of frame numbers for the animation.
   * @param {boolean}     - Repeat the animation once completed.
   */
  function Animation(spritesheet, frameSpeed, startFrame, endFrame) {

    var animationSequence = [];  // array holding the order of the animation
    var currentFrame = 0;        // the current frame to draw
    var counter = 0;             // keep track of frame rate

    // start and end range for frames
    for (var frameNumber = startFrame; frameNumber <= endFrame; frameNumber++)
      animationSequence.push(frameNumber);

    /**
     * Update the animation
     */
    this.update = function() {

      // update to the next frame if it is time
      if (counter == (frameSpeed - 1))
        currentFrame = (currentFrame + 1) % animationSequence.length;

      // update the counter
      counter = (counter + 1) % frameSpeed;
    };

    /**
     * Draw the current frame
     * @param {integer} x - X position to draw
     * @param {integer} y - Y position to draw
     */
    this.draw = function(x, y) {
      // get the row and col of the frame
      var row = Math.floor(animationSequence[currentFrame] / spritesheet.framesPerRow);
      var col = Math.floor(animationSequence[currentFrame] % spritesheet.framesPerRow);

      ctx.drawImage(
        spritesheet.image,
        col * spritesheet.frameWidth, row * spritesheet.frameHeight,
        spritesheet.frameWidth, spritesheet.frameHeight,
        x, y,
        spritesheet.frameWidth, spritesheet.frameHeight);
    };
  }

  /**
   * Get a random number between range
   * @param {integer}
   * @param {integer}
   */
  function rand(low, high) {
    return Math.floor( Math.random() * (high - low + 1) + low );
  }

  /**
   * Bound a number between range
   * @param {integer} num - Number to bound
   * @param {integer}
   * @param {integer}
   */
  function bound(num, low, high) {
    return Math.max( Math.min(num, high), low);
  }

  /**
   * A vector for 2d space.
   * @param {integer} x - Center x coordinate.
   * @param {integer} y - Center y coordinate.
   * @param {integer} dx - Change in x.
   * @param {integer} dy - Change in y.
   */
  function Vector(x, y, dx, dy) {
    // position
    this.x = x || 0;
    this.y = y || 0;
    // direction
    this.dx    = dx    || 0;
    this.dy    = dy    || 0;
  }

  /**
   * Advance the vectors position by dx,dy
   */
  Vector.prototype.advance = function() {
    this.x += this.dx;
    this.y += this.dy;
  };

  /**
   * Get the minimum distance between two vectors
   * @param {Vector}
   * @return minDist
   */
  Vector.prototype.minDist = function(vec) {
    var minDist = Infinity;
    var max     = Math.max( Math.abs(this.dx), Math.abs(this.dy),
                            Math.abs(vec.dx ), Math.abs(vec.dy ) );
    var slice   = 1 / max;

    var x, y, distSquared;

    // get the middle of each vector
    var vec1 = {}, vec2 = {};
    vec1.x = this.x + this.width/2;
    vec1.y = this.y + this.height/2;
    vec2.x = vec.x + vec.width/2;
    vec2.y = vec.y + vec.height/2;
    for (var percent = 0; percent < 1; percent += slice) {
      x = (vec1.x + this.dx * percent) - (vec2.x + vec.dx * percent);
      y = (vec1.y + this.dy * percent) - (vec2.y + vec.dy * percent);
      distSquared = x * x + y * y;

      minDist = Math.min(minDist, distSquared);
    }

    return Math.sqrt(minDist);
  };

  /**
   * Create a parallax background
   */
  var background = (function() {
    this.sky   = {};
    this.backdrop = {};
    this.backdrop2 = {};

    this.sky.x = 0;
    this.sky.y = 0;
    this.sky.speed = 0.2;

    this.backdrop.x = 0;
    this.backdrop.y = 0;
    this.backdrop.speed = 0.4;

    this.backdrop2.x = 0;
    this.backdrop2.y = 0;
    this.backdrop2.speed = 0.6;

    /**
     * Draw the backgrounds to the screen at different speeds
     */
    this.draw = function() {
      ctx.drawImage(assetLoader.imgs.bg, 0, 0);

      // Pan background
      this.sky.x -= this.sky.speed;
      this.backdrop.x -= this.backdrop.speed;
      this.backdrop2.x -= this.backdrop2.speed;

      // draw images side by side to loop
      ctx.drawImage(assetLoader.imgs.sky, this.sky.x, this.sky.y);
      ctx.drawImage(assetLoader.imgs.sky, this.sky.x + canvas.width, this.sky.y);

      ctx.drawImage(assetLoader.imgs.backdrop, this.backdrop.x, this.backdrop.y);
      ctx.drawImage(assetLoader.imgs.backdrop, this.backdrop.x + canvas.width, this.backdrop.y);

      ctx.drawImage(assetLoader.imgs.backdrop2, this.backdrop2.x, this.backdrop2.y);
      ctx.drawImage(assetLoader.imgs.backdrop2, this.backdrop2.x + canvas.width, this.backdrop2.y);

      // If the image scrolled off the screen, reset
      if (this.sky.x + assetLoader.imgs.sky.width <= 0)
        this.sky.x = 0;
      if (this.backdrop.x + assetLoader.imgs.backdrop.width <= 0)
        this.backdrop.x = 0;
      if (this.backdrop2.x + assetLoader.imgs.backdrop2.width <= 0)
        this.backdrop2.x = 0;
    };

    return {
      sky: this.sky,
      backdrop: this.backdrop,
      backdrop2: this.backdrop2,
      draw: this.draw
    };
  })();

  /**
   * The player object
   * @param {integer} x - Starting x position of the player
   * @param {integer} y - Starting y position of the player
   */
  function Player(x, y) {
    this.dy        = 0;
    this.gravity   = 1;
    this.speed     = 6;
    this.jumpDy    = -10;
    this.isJumping = false;
    this.width     = 60;
    this.height    = 96;
    this.sheet     = new SpriteSheet('imgs/normal_walk.png', this.width, this.height);
    this.walkAnim  = new Animation(this.sheet, 4, 0, 15);
    this.jumpAnim  = new Animation(this.sheet, 4, 15, 15);
    this.fallAnim  = new Animation(this.sheet, 4, 11, 11);
    this.anim      = this.walkAnim;
    Vector.call(this, x, y, 0, this.dy);

    var jumpCounter = 0;  // how long the jump button can be pressed down

    /**
     * Update the player's position and animation
     */
    this.update = function() {

      // jump if not currently jumping or falling
      if (KEY_STATUS.space && this.dy === 0 && !this.isJumping) {
        this.isJumping = true;
        this.dy = this.jumpDy;
        jumpCounter = 12;
        assetLoader.sounds.jump.play();
      }

      // jump higher if the space bar is continually pressed
      if (KEY_STATUS.space && jumpCounter) {
        this.dy = this.jumpDy;
      }

      jumpCounter = Math.max(jumpCounter-1, 0);

      this.advance();

      // add gravity
      if (this.isFalling || this.isJumping) {
        this.dy += this.gravity;
      }

      // change animation if falling
      if (this.dy > 0) {
        this.anim = this.fallAnim;
      }
      // change animation is jumping
      else if (this.dy < 0) {
        this.anim = this.jumpAnim;
      }
      else {
        this.anim = this.walkAnim;
      }

      this.anim.update();
    };

    /**
     * Draw the player at it's current position
     */
    this.draw = function() {
      this.anim.draw(this.x, this.y);
    };
  }
  Player.prototype = Object.create(Vector.prototype);

  /**
   * Sprites are anything drawn to the screen (platforms, enemies, etc.)
   * @param {integer} x - Starting x position of the player
   * @param {integer} y - Starting y position of the player
   * @param {string} type - Type of sprite
   */
  function Sprite(x, y, type) {
    this.x      = x;
    this.y      = y;
    this.width  = platformWidth;
    this.height = platformWidth;
    this.type   = type;
    Vector.call(this, x, y, 0, 0);

    /**
     * Update the Sprite's position by the player's speed
     */
    this.update = function() {
      this.dx = -player.speed;
      this.advance();
    };

    /**
     * Draw the sprite at it's current position
     */
    this.draw = function() {
      ctx.save();
      ctx.translate(0.5,0.5);
      ctx.drawImage(assetLoader.imgs[this.type], this.x, this.y);
      ctx.restore();
    };
  }
  Sprite.prototype = Object.create(Vector.prototype);

  /**
   * Get the type of a platform based on platform height
   * @return Type of platform
   */
  function getType() {
    var type;
    switch (platformHeight) {
      case 0:
      case 1:
        type = Math.random() > 0.5 ? 'grass1' : 'grass2';
        break;
      case 2:
        type = 'grass';
        break;
      case 3:
        type = 'bridge';
        break;
      case 4:
        type = 'box';
        break;
    }
    if (platformLength === 1 && platformHeight < 3 && rand(0, 3) === 0) {
      type = 'cliff';
    }

    return type;
  }

  /**
   * Update all platforms position and draw. Also check for collision against the player.
   */
  function updatePlatforms() {
    // animate platforms
    player.isFalling = true;
    for (var i = 0; i < platforms.length; i++) {
      platforms[i].update();
      platforms[i].draw();

      // stop the player from falling when landing on a platform
      var angle;
      if (player.minDist(platforms[i]) <= player.height/2 + platformWidth/2 &&
          (angle = Math.atan2(player.y - platforms[i].y, player.x - platforms[i].x) * 180/Math.PI) > -130 &&
          angle < -50) {
        player.isJumping = false;
        player.isFalling = false;
        player.y = platforms[i].y - player.height + 5;
        player.dy = 0;
      }
    }

    // remove platforms that have gone off screen
    if (platforms[0] && platforms[0].x < -platformWidth) {
      platforms.splice(0, 1);
    }
  }

  /**
   * Update all water position and draw.
   */
  function updateWater() {
    // animate water
    for (var i = 0; i < water.length; i++) {
      water[i].update();
      water[i].draw();
    }

    // remove water that has gone off screen
    if (water[0] && water[0].x < -platformWidth) {
      var w = water.splice(0, 1)[0];
      w.x = water[water.length-1].x + platformWidth;
      water.push(w);
    }
  }

  /**
   * Update all environment position and draw.
   */
  function updateEnvironment() {
    // animate environment
    for (var i = 0; i < environment.length; i++) {
      environment[i].update();
      environment[i].draw();
    }

    // remove environment that have gone off screen
    if (environment[0] && environment[0].x < -platformWidth) {
      environment.splice(0, 1);
    }
  }

  /**
   * Update all enemies position and draw. Also check for collision against the player.
   */
  function updateEnemies() {
    // animate enemies
    for (var i = 0; i < enemies.length; i++) {
      enemies[i].update();
      enemies[i].draw();

      // player ran into enemy
      var angle;
      if (player.minDist(enemies[i]) <= player.width - platformWidth/2) {
        gameOver();
      }
    }

    // remove enemies that have gone off screen
    if (enemies[0] && enemies[0].x < -platformWidth) {
      enemies.splice(0, 1);
    }
  }

  /**
   * Update the players position and draw
   */
  function updatePlayer() {
    player.update();
    player.draw();

    // game over
    if (player.y + player.height >= canvas.height) {
      gameOver();
    }
  }

  /**
   * Spawn new sprites off screen
   */
  function spawnSprites() {
    // increase score
    score++;

    // first create a gap
    if (gapLength > 0) {
      gapLength--;
    }
    // then create platforms
    else if (platformLength > 0) {
      var type = getType();

      platforms.push(new Sprite(
        canvas.width + platformWidth % player.speed,
        platformBase - platformHeight * platformSpacer,
        type
      ));
      platformLength--;

      // add random environment sprites
      spawnEnvironmentSprites();

      // add random enemies
      spawnEnemySprites();
    }
    // start over
    else {
      // increase gap length every speed increase of 4
      gapLength = rand(player.speed - 2, player.speed);
      // only allow a platforms to increase by 1
      platformHeight = bound(rand(0, platformHeight + rand(0, 2)), 0, 4);
      platformLength = rand(Math.floor(player.speed/2), player.speed * 4);
    }
  }

  /**
   * Spawn new environment sprites off screen
   */
  function spawnEnvironmentSprites() {
    if (score > 40 && rand(0, 20) === 0 && platformHeight < 3) {
      if (Math.random() > 0.5) {
        environment.push(new Sprite(
          canvas.width + platformWidth % player.speed,
          platformBase - platformHeight * platformSpacer - platformWidth,
          'plant'
        ));
      }
      else if (platformLength > 2) {
        environment.push(new Sprite(
          canvas.width + platformWidth % player.speed,
          platformBase - platformHeight * platformSpacer - platformWidth,
          'bush1'
        ));
        environment.push(new Sprite(
          canvas.width + platformWidth % player.speed + platformWidth,
          platformBase - platformHeight * platformSpacer - platformWidth,
          'bush2'
        ));
      }
    }
  }

  /**
   * Spawn new enemy sprites off screen
   */
  function spawnEnemySprites() {
    if (score > 100 && Math.random() > 0.96 && enemies.length < 3 && platformLength > 5 &&
        (enemies.length ? canvas.width - enemies[enemies.length-1].x >= platformWidth * 3 ||
         canvas.width - enemies[enemies.length-1].x < platformWidth : true)) {
      enemies.push(new Sprite(
        canvas.width + platformWidth % player.speed,
        platformBase - platformHeight * platformSpacer - platformWidth,
        Math.random() > 0.5 ? 'spikes' : 'slime'
      ));
    }
  }

  /**
   * Game loop
   */
  function animate() {
    if (!stop) {
      requestAnimFrame( animate );
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      background.draw();

      // update entities
      updateWater();
      updateEnvironment();
      updatePlayer();
      updatePlatforms();
      updateEnemies();

      // draw the score
      ctx.fillText('Score: ' + score + 'm', canvas.width - 140, 30);

      // spawn a new Sprite
      if (ticker % Math.floor(platformWidth / player.speed) === 0) {
        spawnSprites();
      }

      // increase player speed only when player is jumping
      if (ticker > (Math.floor(platformWidth / player.speed) * player.speed * 20) && player.dy !== 0) {
        player.speed = bound(++player.speed, 0, 15);
        player.walkAnim.frameSpeed = Math.floor(platformWidth / player.speed) - 1;

        // reset ticker
        ticker = 0;

        // spawn a platform to fill in gap created by increasing player speed
        if (gapLength === 0) {
          var type = getType();
          platforms.push(new Sprite(
            canvas.width + platformWidth % player.speed,
            platformBase - platformHeight * platformSpacer,
            type
          ));
          platformLength--;
        }
      }

      ticker++;
    }
  }

  /**
   * Request Animation Polyfill
   */
  var requestAnimFrame = (function(){
    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            window.oRequestAnimationFrame      ||
            window.msRequestAnimationFrame     ||
            function(callback, element){
              window.setTimeout(callback, 1000 / 60);
            };
  })();

  /**
   * Keep track of the spacebar events
   */
  var KEY_CODES = {
    32: 'space'
  };
  var KEY_STATUS = {};
  for (var code in KEY_CODES) {
    if (KEY_CODES.hasOwnProperty(code)) {
       KEY_STATUS[KEY_CODES[code]] = false;
    }
  }
  document.onkeydown = function(e) {
    var keyCode = (e.keyCode) ? e.keyCode : e.charCode;
    if (KEY_CODES[keyCode]) {
      e.preventDefault();
      KEY_STATUS[KEY_CODES[keyCode]] = true;
    }
  };
  document.onkeyup = function(e) {
    var keyCode = (e.keyCode) ? e.keyCode : e.charCode;
    if (KEY_CODES[keyCode]) {
      e.preventDefault();
      KEY_STATUS[KEY_CODES[keyCode]] = false;
    }
  };

  /**
   * Show asset loading progress
   * @param {integer} progress - Number of assets loaded
   * @param {integer} total - Total number of assets
   */
  function assetProgress(progress, total) {
    var pBar = document.getElementById('progress-bar');
    pBar.value = progress / total;
    document.getElementById('p').innerHTML = Math.round(pBar.value * 100) + "%";
  }

  /**
   * Show the main menu after loading all assets
   */
  function mainMenu() {
    assetLoader.sounds.bg.loop = true;
    $('#progress').hide();
    $('#main').show();
    $('#menu').addClass('main');
    $('.sound').show();
  }

  /**
   * Start the game - reset all variables and entities, spawn platforms and water.
   */
  function startGame() {
    platforms = [];
    water = [];
    environment = [];
    enemies = [];
    player = new Player(64, 250);
    ticker = 0;
    stop = false;
    score = 0;
    background.sky.x = 0;
    background.backdrop.x = 0;
    background.backdrop.y = 0;
    platformHeight = 2;
    platformLength = 15;
    gapLength = 0;

    for (var i = 0; i < 30; i++) {
      platforms.push(new Sprite(i * (platformWidth-3), platformBase - platformHeight * platformSpacer, 'grass'));
    }

    for (i = 0; i < canvas.width / 32 + 2; i++) {
      water.push(new Sprite(i * platformWidth, platformBase, 'water'));
    }

    animate();

    assetLoader.sounds.gameOver.pause();
    assetLoader.sounds.bg.currentTime = 0;
    assetLoader.sounds.bg.play();
  }

  /**
   * End the game and restart
   */
  function gameOver() {
    stop = true;
    $('#score').html(score);
    $('#game-over').show();
    assetLoader.sounds.bg.pause();
    assetLoader.sounds.gameOver.currentTime = 0;
    assetLoader.sounds.gameOver.play();
  }

  /**
   * Click handlers for the different menu screens
   */
  $('.credits').click(function() {
    $('#main').hide();
    $('#credits').show();
    $('#menu').addClass('credits');
  });
  $('.back').click(function() {
    $('#credits').hide();
    $('#main').show();
    $('#menu').removeClass('credits');
  });
  $('.sound').click(function() {
    var $this = $(this);
    // sound off
    if ($this.hasClass('sound-on')) {
      $this.removeClass('sound-on').addClass('sound-off');
      volume = 0;
    }
    // sound on
    else {
      $this.removeClass('sound-off').addClass('sound-on');
      volume = 1;
    }

    if (canUseLocalStorage) {
      localStorage['game.playSound'] = volume;
    }

    for (var sound in assetLoader.sounds) {
      if (assetLoader.sounds.hasOwnProperty(sound)) {
        assetLoader.sounds[sound].volume = volume;
      }
    }
  });
  $('.play').click(function() {
    $('#menu').hide();
    startGame();
  });
  $('.restart').click(function() {
    $('#game-over').hide();
    startGame();
  });
}(jQuery));