AFRAME.registerComponent('grab-controller', {
  schema: {
    grabRadius: { type: 'number', default: 2 }
  },

  init: function () {
    this.grabbedEl = null;
    this.offset = new THREE.Vector3();
    this.handPos = new THREE.Vector3();
    this.lastHandPos = new THREE.Vector3();
    this.handVelocity = new THREE.Vector3();

    this.onGripDown = this.onGripDown.bind(this);
    this.onGripUp = this.onGripUp.bind(this);
    this.el.addEventListener('gripdown', this.onGripDown);
    this.el.addEventListener('gripup', this.onGripUp);
  },

  onGripDown: function () {
    const grabbables = document.querySelectorAll('[grabbable]');
    this.el.object3D.getWorldPosition(this.handPos);

    let closestEl = null;
    let closestDist = this.data.grabRadius;

    grabbables.forEach((el) => {
      const pos = new THREE.Vector3();
      el.object3D.getWorldPosition(pos);
      const dist = this.handPos.distanceTo(pos);
      if (dist < closestDist) {
        closestDist = dist;
        closestEl = el;
      }
    });

    if (closestEl) this.grab(closestEl);
  },

  grab: function (el) {
    this.grabbedEl = el;
    const body = el.body;
    if (!body) return;

    // 2 = KINEMATIC dans cannon-es : plus affecté par la gravité,
    // mais on peut toujours modifier sa position/rotation à la main
    body.type = 2;
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);

    this.lastHandPos.copy(this.handPos);
  },

  onGripUp: function () {
    if (!this.grabbedEl) return;
    const body = this.grabbedEl.body;

    if (body) {
      // 1 = DYNAMIC : la gravité et les collisions reprennent
      body.type = 1;
      body.velocity.set(this.handVelocity.x, this.handVelocity.y, this.handVelocity.z);
    }

    this.grabbedEl = null;
  },

  tick: function (time, delta) {
    if (!this.grabbedEl) return;
    const body = this.grabbedEl.body;
    if (!body) return;

    this.el.object3D.getWorldPosition(this.handPos);
    const handQuat = new THREE.Quaternion();
    this.el.object3D.getWorldQuaternion(handQuat);

    // calcule la vitesse de la main pour pouvoir "lancer" l'objet au relâchement
    const dt = delta / 1000;
    if (dt > 0) {
      this.handVelocity.subVectors(this.handPos, this.lastHandPos).divideScalar(dt);
    }
    this.lastHandPos.copy(this.handPos);

    // fait suivre l'objet à la main
    body.position.set(this.handPos.x, this.handPos.y, this.handPos.z);
    body.quaternion.set(handQuat.x, handQuat.y, handQuat.z, handQuat.w);
  }
});

AFRAME.registerComponent('vr-turn', {
  schema: { speed: { type: 'number', default: 90 } },
  init: function () {
    this.axis = [0, 0, 0, 0];
    this.el.addEventListener('axismove', (evt) => { this.axis = evt.detail.axis; });
  },
  tick: function (time, delta) {
    const x = this.axis[2] ?? 0;
    if (Math.abs(x) < 0.2) return;

    const cameraRig = this.el.parentEl; // maintenant #cameraRig, pas #rig
    const dt = delta / 1000;
    cameraRig.object3D.rotation.y -= x * THREE.MathUtils.degToRad(this.data.speed) * dt;
  }
});

AFRAME.registerComponent('vr-move', {
  schema: { speed: { type: 'number', default: 4 } },
  init: function () {
    this.axis = [0, 0];
    this.el.addEventListener('axismove', (evt) => { this.axis = evt.detail.axis; });

    // Ligne de debug temporaire — this.el.addEventListener('axismove', (e) => console.log('axismove', e.detail.axis));

    const rig = this.el.parentEl.parentEl; // #rig, via #cameraRig;
    rig.addEventListener('body-loaded', () => {
      this.body = rig.body;
      this.body.fixedRotation = true;
      this.body.angularFactor.set(0, 0, 0); // gardez cette ligne aussi, pas seulement fixedRotation
      this.body.updateMassProperties();
    });
  },


  tick: function () {
    const rig = this.el.parentEl.parentEl;
    const body = rig.body;
    if (!body) return;

    // Quest/Oculus Touch: axis[2] = stick X, axis[3] = stick Y
    let x = this.axis[2] ?? 0;
    let y = this.axis[3] ?? 0;
    const deadzone = 0.15;
    if (Math.abs(x) < deadzone) x = 0;
    if (Math.abs(y) < deadzone) y = 0;

    const camera = rig.querySelector('[camera]');
    if (!camera) return;

    const forward = new THREE.Vector3();
    camera.object3D.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(forward.z, 0, +forward.x);

    const speed = this.data.speed;
    // y négatif = stick poussé vers l'avant sur la plupart des manettes
    const moveX = (right.x * x + forward.x * y) * speed;
    const moveZ = (right.z * x + forward.z * y) * speed;

    body.velocity.x = moveX;
    body.velocity.z = moveZ;
  }
});