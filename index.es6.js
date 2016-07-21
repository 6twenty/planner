// Drives the app
class App {

  constructor() {
    this.el = document.body
    this._filtered = ''

    if (navigator.standalone) {
      this.el.classList.add('standalone')
    }

    const colorHash = new ColorHash({ lightness: [0.8, 0.85, 0.9], saturation: [0.8, 0.9, 1] })

    App.hsl = (string) => {
      let hsl = colorHash.hsl(string)

      // Avoid hues in the blue range
      if (hsl[0] > 200 && hsl[0] < 280) {
        hsl = App.hsl(string + '_')
      }

      return hsl
    }

    App.canDrag = true

    this.loop()
    this.hammer()
    this.build()
    this.observe()

    this.list = new List({
      app: this
    })

    this.list.build()
    this.list.render()

    this.loading()
    this.firebase().then(this.init.bind(this))
  }

  static uniqueId() {
    this._counter = this._counter || 0
    return ++this._counter
  }

  static escapeRegex(string) {
    return string.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
  }

  static markdown(string) {
    string = string.replace(/(^|\s)(#(\w+))\b/g, (match, initial, hashtag) => {
      const hsl = App.hsl(hashtag.toLowerCase().replace('#', ''))
      const color = `hsl(${hsl[0]}, ${hsl[1]*100}%, ${hsl[2]*100}%)`
      return `${initial}<span style="color:${color}">${hashtag}</span>`
    })

    let isWithinCodeBlock = false
    const array = string.split('')

    string = array.map((char, i) => {
      const lastChar = array[i-1]
      const nextChar = array[i+1]

      if (isWithinCodeBlock) {
        if (char === '`' && lastChar !== '`') {
          isWithinCodeBlock = false
        }
      } else {
        if (char === '`' && lastChar !== '`') {
          isWithinCodeBlock = true
        } else if (char === '-' && nextChar === '-') {
          return ''
        } else if (char === '-' && lastChar === '-') {
          return '—'
        }
      }

      return char
    }).join('')

    return marked(string)
  }

  // Examples:
  // - January 12 - 19
  // - January 12 - February 3
  static formatWeekRange(range) {
    const today = moment()
    let fromFormat = 'MMMM D'
    let toFormat = 'MMMM D'

    if (range.from.month() === range.to.month()) {
      toFormat = 'D'
    }

    const fromDate = range.from.format(fromFormat)
    const toDate = range.to.format(toFormat)

    return `${fromDate} - ${toDate}`
  }

  get filtered() {
    return this._filtered
  }

  set filtered(value) {
    this._filtered = value
    this.aside.innerText = value
    this.list.filter()
  }

  get env() {
    if (this._env) return this._env

    this._env = 'dev'

    if (location.hostname === 'planner-6059a.firebaseapp.com') {
      this._env = 'prod'
    }

    return this._env
  }

  get config() {
    if (this._config) return this._config

    const configs = {
      dev: {
        apiKey: "AIzaSyAqvyzUD5ioSwBSkj1zd61a_LipptjQb0M",
        authDomain: "planner-dev-73d1e.firebaseapp.com",
        databaseURL: "https://planner-dev-73d1e.firebaseio.com",
        storageBucket: "",
      },

      prod: {
        apiKey: "AIzaSyBgNTLh6iZ8itiE0-JaJJqlyUJ4aW4rB3c",
        authDomain: "planner-6059a.firebaseapp.com",
        databaseURL: "https://planner-6059a.firebaseio.com",
        storageBucket: "",
      }
    }

    this._config = configs[this.env]

    return this._config
  }

  firebase() {
    const anHourAgo = moment().subtract(1, 'hour')
    const awaitingAuthRedirect = sessionStorage.getItem('awaitingAuthRedirect')

    let isAwaitingAuthRedirect = false
    if (awaitingAuthRedirect) {
      isAwaitingAuthRedirect = moment(awaitingAuthRedirect).isAfter(anHourAgo)
      sessionStorage.removeItem('awaitingAuthRedirect')
    }

    firebase.initializeApp(this.config)

    return new Promise((resolve, reject) => {

      firebase.auth().onAuthStateChanged(user => {
        if (user || !isAwaitingAuthRedirect) {
          resolve()
        } else {
          firebase.auth().getRedirectResult().then(resolve).catch(error => {
            resolve() // TODO - show a notice?
          })
        }
      })

    })
  }

  signIn(provider) {
    const authProvider = new firebase.auth[provider]()

    this.modal.dataset.active = '#loading'
    sessionStorage.setItem('awaitingAuthRedirect', moment().format())
    firebase.auth().signInWithRedirect(authProvider)
  }

  signOut() {
    firebase.auth().signOut()
    this.list.unload()

    const settings = this.el.querySelector('.settings')
    const profile = this.el.querySelector('.profile')

    settings.innerText = ''
    profile.innerText = ''

    settings.removeAttribute('style')
    profile.removeAttribute('style')

    this.modal.dataset.active = '#providers'
  }

  loading() {
    this.modal.dataset.active = '#loading'
  }

  init() {
    const user = firebase.auth().currentUser

    if (user) {
      const settings = this.el.querySelector('.settings')
      const profile = this.el.querySelector('.profile')
      const letter = user.displayName ? user.displayName[0] : '?'

      settings.innerText = letter
      profile.innerText = letter

      if (user.photoURL) {
        settings.style.backgroundImage = `url(${user.photoURL})`
        profile.style.backgroundImage = `url(${user.photoURL})`
      }

      this.db = firebase.database().ref(`users/${user.uid}/items`)

      const ref = this.db.orderByChild('order')

      ref.limitToFirst(1).once('value', data => {
        if (this.modal.dataset.active === '#loading') {
          this.modal.dataset.active = ''
        }
      })

      ref.on('child_added', data => {
        this.list.loadItem(data.key, data.val())
      })

      ref.on('child_changed', data => {
        this.list.updateItem(data.key, data.val())
      })

      ref.on('child_removed', data => {
        this.list.removeItem(data.key, data.val())
      })
    } else {
      this.modal.dataset.active = '#providers'
    }
  }

  loop() {
    requestAnimationFrame(timestamp => {
      this.tick()
    })
  }

  tick() {
    if (this.db && Object.keys(this.list.updates).length > 0) {
      const keys = Object.keys(this.list.updates)

      keys.forEach(key => {
        const item = this.list.items[key]
        const attrs = this.list.updates[key]

        if (!('group' in attrs)) attrs.group = item.section.id
        if (!('content' in attrs)) attrs.content = item.content
        if (!('order' in attrs)) attrs.order = item.order
      })

      this.db.update(this.list.updates)
      this.list.updates = {}
    }

    this.list.sections.filter(section => {
      return section.stale
    }).forEach(section => {
      section.stale = false
      section.reorderToDOM()
    })

    this.loop()
  }

  build() {
    this.buildAside()
    this.buildModal()
  }

  buildAside() {
    this.aside = document.createElement('aside')

    this.el.appendChild(this.aside)
  }

  buildModal() {
    this.modal = document.createElement('div')
    this.modal.classList.add('modal')

    this.buildModalLoading()
    this.buildModalProviders()
    this.buildModalSettings()

    this.el.appendChild(this.modal)
  }

  buildModalLoading() {
    const section = document.createElement('section')
    const div = document.createElement('div')

    section.dataset.id = 'loading'
    div.classList.add('loading')
    section.appendChild(div)

    this.modal.appendChild(section)
  }

  buildModalProviders() {
    const section = document.createElement('section')
    const a = document.createElement('a')
    const img = document.createElement('img')

    section.dataset.id = 'providers'
    img.src = `/google.svg`
    a.classList.add('provider')
    a.appendChild(img)
    section.appendChild(a)

    a.addEventListener('singletap', e => {
      e.stopPropagation()

      this.signIn('GoogleAuthProvider')
    })

    this.modal.appendChild(section)
  }

  buildModalSettings() {
    const section = document.createElement('section')
    const close = document.createElement('a')
    const profile = document.createElement('div')
    const signOut = document.createElement('button')

    close.classList.add('close')
    profile.classList.add('profile')
    signOut.innerText = 'Sign out'
    section.dataset.id = 'settings'

    section.appendChild(close)
    section.appendChild(profile)
    section.appendChild(signOut)

    close.addEventListener('singletap', e => {
      e.stopPropagation()

      this.list.app.modal.dataset.active = ''
    })

    signOut.addEventListener('singletap', e => {
      e.stopPropagation()

      this.signOut()
    })

    this.modal.appendChild(section)
  }

  hammer() {
    this.hammer = new Hammer.Manager(this.el, { domEvents: true })

    const singleTap = new Hammer.Tap({ event: 'singletap', taps: 1 })
    const doubleTap = new Hammer.Tap({ event: 'doubletap', taps: 2 })

    this.hammer.add(doubleTap)
    this.hammer.add(singleTap)
  }

  observe() {

    // For regular keys, use `keypress` (provides the correct char code)
    window.addEventListener('keypress', e => {
      if (this.list.editing) return
      if (e.metaKey) return
      if (e.ctrlKey) return
      if (e.altKey) return
      if (e.which === 13) return

      e.stopPropagation()

      const char = String.fromCharCode(e.which)

      if (!char) return

      this.filtered += char
    })

    // For special keys (esc and backspace), use `keydown`
    window.addEventListener('keydown', e => {
      if (this.list.editing) return
      if (e.metaKey) return
      if (e.ctrlKey) return
      if (e.altKey) return
      if (e.shiftKey) return

      if (e.which === 27) { // Esc
        e.preventDefault()
        e.stopPropagation()

        if (this.modal.dataset.active === '#settings') {
          this.modal.dataset.active = ''
        }

        if (document.activeElement) {
          document.activeElement.blur()
        }

        this.filtered = ''
        if (this.list.drake.dragging) {
          this.list.drake.cancel(true)
          if (this.list.originalSectionId) {
            this.list.el.dataset.active = `#${this.list.originalSectionId}`
          }
        }
      }

      if (e.which === 8) { // Backspace
        e.preventDefault()
        e.stopPropagation()

        this.filtered = this.filtered.slice(0, this.filtered.length - 1)
      }
    })

  }

  load(cached) {
    const orders = {}

    const updates = cached.reduce((items, item) => {
      let section = this.list.sectionById[item.group]

      if (!section) {
        section = this.list.sectionById.overdue
      }

      if (!(section.id in orders)) {
        orders[section.id] = 0
      }

      const ref = this.list.app.db.push()

      items[ref.key] = {
        group: section.id,
        content: '',
        order: ++orders[section.id]
      }

      return items
    }, {})

    this.db.update(updates)
  }

}

// Can have multiple lists, but only one is active
// Lists hold all the items within
class List {

  constructor(opts) {
    if (opts.name) this.name = opts.name
    this.app = opts.app
    this.el = document.createElement('main')
    this.items = {}
    this.updates = {}
  }

  build() {
    this.sections = [] // Ordered, for rendering sequentially
    this.sectionById = {} // For easy lookup

    const date = moment().startOf('day').subtract(1, 'day')
    const days = ['today', 'tomorrow', 'day-after-tomorrow']

    // Sundays are skipped, so if today is Sunday, pretend it's Saturday
    if (moment().day() === 0) date.subtract(1, 'day')

    this.el.dataset.active = ''

    days.forEach(day => {
      date.add(1, 'days')

      if (date.day() === 0) {
        // Skip Sundays
        date.add(1, 'days')
      }

      const section = new DaySection({
        list: this,
        date: date,
        sectionId: day
      })

      section.build()
      section.render(this.el)

      this.sections.push(section)
      this.sectionById[section.id] = section
    })


    const sectionClasses = [ WeekSection, MonthSection, BacklogSection, OverdueSection, DoneSection ]

    sectionClasses.forEach(SectionClass => {
      const section = new SectionClass({
        list: this
      })

      section.build()
      section.render(this.el)

      this.sections.push(section)
      this.sectionById[section.id] = section
    })

    this.dragula()

    return this
  }

  dragula() {
    const lists = this.sections.map(section => { return section.listEl })
    const headers = this.sections.map(section => { return section.header })
    const els = [...lists, ...headers]

    this.drake = dragula({
      containers: els,
      mirrorContainer: this.el,
      moves: (el, source, handle, sibling) => {
        if (source.nodeName === 'HEADER') {
          return false
        }

        if (!App.canDrag) {
          return false
        }

        const item = this.items[el.dataset.key]

        if (item.el.contentEditable === 'true') {
          return false
        }

        return true
      },
      accepts: (el, target, source, sibling) => {
        const section = this.sectionById[target.parentElement.dataset.id]
        const active = section.list.el.querySelector('section.over')
        const mirror = this.el.querySelector('.item.gu-mirror')

        if (active) {
          active.classList.remove('over')
        }

        section.el.classList.add('over')
        this.el.dataset.active = `#${section.sectionId}`
        mirror.dataset.sectionType = target.parentElement.dataset.name

        if (target.nodeName === 'HEADER') {
          if (target.parentElement === el.parentElement.parentElement) {
            return false
          }

          section.listEl.insertBefore(el, section.listEl.firstChild)

          return false
        }

        return true
      }
    })

    this.drake.on('drag', (el) => {
      this.originalSectionId = el.parentElement.parentElement.dataset.sectionId
      el.parentElement.parentElement.classList.add('over')
    })

    this.drake.on('dragend', (el) => {
      const active = this.el.querySelector('section.over')

      if (active) {
        active.classList.remove('over')
      }
    })

    this.drake.on('drop', (el, target, source, sibling) => {
      const item = this.items[el.dataset.key]
      const section = this.sectionById[target.parentElement.dataset.id]

      section.reorderFromDOM()

      if (section !== item.section) {
        item.section.reorderFromDOM()
      }
    })

    this.drake.on('cloned', (clone, original, type) => {
      const color = getComputedStyle(original).backgroundColor
      clone.style.boxShadow = `inset 0 0 0 50vw ${color}`
    })
  }

  loadItem(key, attrs) {
    const item = new Item({
      key: key,
      list: this,
      group: attrs.group,
      content: attrs.content,
      order: attrs.order
    })

    item.build()
    item.section.stale = true
  }

  updateItem(key, attrs) {
    const item = this.items[key]
    const previousSection = item.section

    item.init(attrs)
    item.rebuild()

    item.section.stale = true
    previousSection.stale = true
  }

  removeItem(key, attrs) {
    const item = this.items[key]

    item.remove()
  }

  unload() {
    const keys = Object.keys(this.items)

    keys.forEach(key => {
      const item = this.items[key]

      item.remove()
    })
  }

  render() {
    this.app.el.appendChild(this.el)
  }

  filter() {
    const regex = new RegExp(App.escapeRegex(this.app.filtered), 'i')

    Object.keys(this.items).forEach(key => {
      const item = this.items[key]

      if (regex.test(item.content)) {
        item.show()
      } else {
        item.hide()
      }
    })
  }

}

// Represents a visual group, and is where items get rendered
class Section {

  constructor(opts) {
    this.id = opts.id || opts.name
    this.list = opts.list
    this.name = opts.name
    this.title = opts.name
    this.sectionId = opts.sectionId

    this.classes = new Set()
    this.classes.add(opts.name)
    this.classes.add(opts.sectionId)

    this.stale = false
  }

  get items() {
    const keys = Object.keys(this.list.items)

    return keys.reduce((items, key) => {
      const item = this.list.items[key]

      if (item.section === this) {
        items.push(item)
      }

      return items
    }, []).sort((a, b) => {
      return a.order - b.order
    })
  }

  build() {
    const section = document.createElement('section')
    const header = document.createElement('header')
    const back = document.createElement('button')
    const list = document.createElement('div')

    section.appendChild(header)
    section.appendChild(list)

    section.dataset.id = this.id
    section.dataset.name = this.name
    section.dataset.sectionId = this.sectionId

    this.classes.forEach(className => {
      section.classList.add(className)
    })

    const emoji = this.emoji()

    if (emoji) {
      header.dataset.emoji = emoji
    }

    header.innerText = this.title
    back.classList.add('back')
    list.classList.add('list')
    header.appendChild(back)

    this.el = section
    this.header = header
    this.listEl = list

    this.el.addEventListener('doubletap', e => {
      if (e.target !== this.listEl && e.target !== this.header) {
        return
      }

      e.stopPropagation()

      const first = e.target !== this.listEl
      let order

      if (first) {
        order = 1
        this.reorderFromIndex(2)
      } else {
        order = this.items.length + 1
      }

      const item = new Item({
        list: this.list
      })

      this.list.editing = item.key

      item.update({
        group: this.id,
        content: '',
        order: order
      })
    })

    header.addEventListener('singletap', e => {
      if (e.target !== header) return

      e.stopPropagation()

      this.list.el.dataset.active = `#${this.sectionId}`
    })

    back.addEventListener('singletap', e => {
      if (e.target !== back) return

      e.stopPropagation()

      this.list.el.dataset.active = ''
    })

    return this
  }

  emoji() {

  }

  render(parent) {
    parent.appendChild(this.el)
  }

  reorderFromIndex(index) {
    this.items.reduce((n, item) => {
      item.order = n

      return ++n
    }, index)
  }

  reorderFromDOM() {
    const els = this.el.querySelectorAll('.item:not(.gu-mirror)')
    const keys = [...els].map(el => { return el.dataset.key })
    const items = keys.map(key => { return this.list.items[key] })

    items.reduce((n, item) => {
      item.update({
        group: this.id,
        order: n
      })

      return ++n
    }, 1)
  }

  reorderToDOM() {
    const scrollTop = this.listEl.scrollTop

    this.items.forEach(item => {
      item.detach()
      item.render()
    })

    this.listEl.scrollTop = scrollTop
  }

}

class DaySection extends Section {

  constructor(opts) {
    const date = opts.date
    const today = moment().startOf('day')

    if (today.day() === 0) {
      today.subtract(1, 'day')
    }

    const isToday = date.isSame(today)
    const isSaturday = date.day() === 6

    opts.id = date.format('YYYY-MM-DD')
    opts.name = 'day'
    super(opts)

    this.date = date
    this.title = date.format('dddd')

    if (isSaturday) {
      this.classes.add('weekend')
    }

    if (isToday && isSaturday) {
      this.title = 'This weekend'
    } else if (isToday) {
      this.title = 'Today'
    } else if (isSaturday) {
      this.title = 'Weekend'
    }
  }

  build() {
    super.build()

    const today = moment().startOf('day')
    let day = this.date.format('dddd')

    if (today.day() === 0) {
      today.subtract(1, 'day')
    }

    if (this.date.isSame(today)) {
      day = 'today'
    }

    if (this.date.day() === 6) {
      day = 'the weekend'
    }

    this.listEl.dataset.day = day

    if (this.date.isSame(today)) {
      const settings = document.createElement('a')

      settings.classList.add('settings')

      settings.addEventListener('singletap', e => {
        e.stopPropagation()

        this.list.app.modal.dataset.active = '#settings'
      })

      this.header.appendChild(settings)
    }

    return this
  }

}

class WeekSection extends Section {

  constructor(opts) {
    const dateStart = moment().startOf('week')
    const dateEnd = moment().endOf('week')

    opts.id = `${dateStart.format('YYYY-MM-DD')}-${dateEnd.format('YYYY-MM-DD')}`
    opts.name = 'week'
    opts.sectionId = 'week'
    super(opts)

    this.title = 'This week'
  }

  build() {
    const dateStart = moment().startOf('week')
    const dateEnd = moment().endOf('week')

    super.build()

    this.listEl.dataset.dates = App.formatWeekRange({ from: dateStart, to: dateEnd })

    return this
  }

}

class MonthSection extends Section {

  constructor(opts) {
    const dateStart = moment().startOf('month')
    const dateEnd = moment().endOf('month')

    opts.id = `${dateStart.format('YYYY-MM-DD')}-${dateEnd.format('YYYY-MM-DD')}`
    opts.name = 'month'
    opts.sectionId = 'month'
    super(opts)

    this.title = 'This month'
  }

  build() {
    const date = moment()

    super.build()

    this.listEl.dataset.date = date.format('MMMM')

    return this
  }

}

class DoneSection extends Section {

  constructor(opts) {
    opts.name = 'done'
    opts.sectionId = 'done'
    super(opts)
  }

  emoji() {
    return '😍'
  }

  build() {
    super.build()

    const button = document.createElement('button')

    button.classList.add('clear')
    button.innerText ='Clear'
    this.el.appendChild(button)

    button.addEventListener('singletap', e => {
      e.stopPropagation()

      this.clear()
    })

    return this
  }

  clear() {
    Object.keys(this.list.items).forEach(key => {
      const item = this.list.items[key]
      if (item.section.id === this.id) {
        item.delete()
      }
    })
  }

}

class OverdueSection extends Section {

  constructor(opts) {
    opts.name = 'overdue'
    opts.sectionId = 'overdue'
    super(opts)
  }

  emoji() {
    return '😰'
  }

}

class BacklogSection extends Section {

  constructor(opts) {
    opts.name = 'backlog'
    opts.sectionId = 'backlog'
    super(opts)
  }

}

// Items have an ID (not persisted) and text content and belong to a section
class Item {

  constructor(opts) {
    this.list = opts.list

    this.init(opts)

    if (opts.key) {
      this.key = opts.key
    } else {
      const ref = this.list.app.db.push()
      this.key = ref.key
    }

    this.list.items[this.key] = this

    this.bindings()
  }

  init(attrs) {
    if ('group' in attrs) this.section = this.list.sectionById[attrs.group]
    if ('content' in attrs) this.content = attrs.content
    if ('order' in attrs) this.order = attrs.order
  }

  bindings() {
    this.onSingleTap = this.onSingleTap.bind(this)
    this.onDoubleTap = this.onDoubleTap.bind(this)
    this.onKeydown = this.onKeydown.bind(this)
    this.onBlur = this.onBlur.bind(this)
    this.onPaste = this.onPaste.bind(this)
    this.onTouchStart = this.onTouchStart.bind(this)
    this.onTouchMove = this.onTouchMove.bind(this)
    this.onTouchEnd = this.onTouchEnd.bind(this)
    this.onMouseMove = this.onMouseMove.bind(this)
  }

  get section () {
    return this._section
  }

  set section(value) {
    if (!value) {
      value = this.list.sectionById.overdue
    }

    this._section = value
  }

  build() {
    const el = document.createElement('article')

    el.classList.add('item')
    el.dataset.sectionType = this.section.name
    el.dataset.key = this.key
    el.innerHTML = App.markdown(this.content)
    el.tabIndex = 1

    el.addEventListener('keydown', this.onKeydown)

    this.el = el

    if (this.list.editing === this.key) {
      this.startEditing()
    } else {
      this.awaitEditing()
    }
  }

  rebuild() {
    this.el.dataset.sectionType = this.section.name
    this.el.innerHTML = App.markdown(this.content)
  }

  render() {
    this.section.listEl.appendChild(this.el)

    if (this.list.editing === this.key) {
      this.el.focus()
      setTimeout(() => {
        this.el.scrollIntoView()
      }, 0)
    }
  }

  detach() {
    if (!this.el.parentElement) return

    this.el.parentElement.removeChild(this.el)
  }

  remove() {
    this.detach()

    delete this.list.items[this.key]
  }

  show() {
    this.el.style.display = ''
  }

  hide() {
    this.el.style.display = 'none'
  }

  startEditing() {
    this._html = this.el.innerHTML
    this.list.editing = this.key
    this.el.contentEditable = 'true'
    this.el.innerText = this.content

    if (this.el.parentElement) {
      this.focus() // Ensure cursor is at end
    } else {
      this.el.focus()
    }

    this.el.removeEventListener('singletap', this.onSingleTap)
    this.el.removeEventListener('doubletap', this.onDoubleTap)
    this.el.removeEventListener('touchstart', this.onTouchStart)
    this.el.removeEventListener('touchmove', this.onTouchMove)
    this.el.removeEventListener('touchend', this.onTouchEnd)
    this.el.removeEventListener('touchcancel', this.onTouchEnd)
    this.el.removeEventListener('mousedown', this.onMouseMove)
    this.el.addEventListener('blur', this.onBlur)
    this.el.addEventListener('paste', this.onPaste)
  }

  finishEditing() {
    this.list.editing = null
    this.el.contentEditable = 'false'
    this.el.removeEventListener('blur', this.onBlur)
    this.el.removeEventListener('paste', this.onPaste)

    const content = this.el.innerText

    this.el.innerHTML = this._html
    delete this._html

    if (content.replace(/\s/g, '') === '') {
      return this.delete()
    }

    this.awaitEditing()

    this.update({
      content: content
    })
  }

  cancelEditing() {
    this.el.innerText = this.content
    this.finishEditing()
  }

  awaitEditing() {
    this.el.addEventListener('singletap', this.onSingleTap)
    this.el.addEventListener('doubletap', this.onDoubleTap)
    this.el.addEventListener('touchstart', this.onTouchStart)
    this.el.addEventListener('touchmove', this.onTouchMove)
    this.el.addEventListener('touchend', this.onTouchEnd)
    this.el.addEventListener('touchcancel', this.onTouchEnd)
    this.el.addEventListener('mousedown', this.onMouseMove)
  }

  update(attrs) {
    if (!attrs) {
      attrs = {}
    }

    this.list.updates[this.key] = attrs
  }

  delete() {
    const ref = this.list.app.db.child(this.key)

    ref.remove()
  }

  focus() {
    const range = document.createRange()
    const selection = window.getSelection()

    this.el.focus()
    range.selectNodeContents(this.el)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  onSingleTap(e) {
    e.stopPropagation()

    if (document.activeElement === this.el) {
      this.el.blur()
    } else {
      this.el.focus()
    }
  }

  onDoubleTap(e) {
    e.stopPropagation()

    this.startEditing()
  }

  onKeydown(e) {
    if (e.which === 13 && !e.shiftKey) {
      e.preventDefault()
    }

    e.stopPropagation()

    if (this.el.contentEditable === 'true') {
      if (e.which === 27) this.cancelEditing() // Esc
      if (e.which === 13 && !e.shiftKey) this.el.blur() // Enter
    } else {
      if (e.which === 13) this.startEditing() // Enter
    }
  }

  onBlur(e) {
    this.finishEditing()
  }

  onPaste(e) {
    e.preventDefault()
    e.stopPropagation()

    const clipboardData = e.clipboardData || window.clipboardData
    const pastedData = clipboardData.getData('Text')
    const selection = window.getSelection()
    const range = selection.getRangeAt(0)

    range.deleteContents()
    range.insertNode(document.createTextNode(pastedData))
    this.focus()
  }

  onTouchStart(e) {
    if ('_allowDrag' in this) return

    App.canDrag = false

    this._timer = setTimeout(() => {
      this._allowDrag = App.canDrag = true
      this.el.dispatchEvent(e)
      delete this._allowDrag
    }, 500)
  }

  onTouchMove(e) {
    clearTimeout(this._timer)
  }

  onTouchEnd(e) {
    clearTimeout(this._timer)
  }

  onMouseMove(e) {
    clearTimeout(this._timer)
    App.canDrag = true
  }

}

const app = new App()
