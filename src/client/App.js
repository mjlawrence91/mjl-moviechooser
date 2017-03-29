'use strict'

import RippleHandler from './RippleHandler'

class App {
  static get WHOS () {
    return {
      'Alex': {primary: '#9C27B0'},
      'Charl': {primary: '#4CAF50'},
      'Matt': {primary: '#2196F3'},
      'Rob': {primary: '#F44336'}
    }
  }

  static get ENTER_KEYCODE () {
    return 13
  }

  static get POLYFILLS () {
    return {
      wcLoader: 'lib/webcomponents-loader.js',
      ceAdapter: 'lib/custom-elements-es5-adapter.js'
    }
  }

  get customElementsSupported () {
    return !!window.customElements
  }

  get shadowDOMSupported () {
    return !!HTMLElement.prototype.attachShadow
  }

  get htmlImportsSupported () {
    return ('import' in document.createElement('link'))
  }

  constructor (window) {
    this._rippleHandler = new RippleHandler()

    // Needed for mobile doubletap handler
    this._tappedTwice = false

    // Ensures all methods are accessible throughout the class
    this._createBindings()
  }

  bootstrap () {
    // Register service worker
    if ('serviceWorker' in navigator) {
    // navigator.serviceWorker.register('./sw.js', {scope: '/'})
    }

    // Load webcomponents polyfills and HTML imports
    return new Promise((resolve, reject) => {
      // Load polyfills
      Promise.all([
        this._lazyLoadScript(App.POLYFILLS.ceAdapter),
        this._lazyLoadScript(App.POLYFILLS.wcLoader)
      ]).then(result => {
        // Load HTML imports
        return Promise.all([
          this._lazyLoadImport('elements/movie-list.html'),
          this._lazyLoadImport('elements/movie-list-item.html')
        ])
      }).then(result => resolve(result))
        .catch(error => reject(`Error occurred loading polyfills: ${error}`))
    })
  }

  init () {
    this.bootstrap().then(_ => {
      console.info('Custom Elements supported', this.customElementsSupported)
      console.info('Shadow DOM supported', this.shadowDOMSupported)
      console.info('HTML Imports supported', this.htmlImportsSupported)

      // Load filters for who suggested a movie
      this.renderWhosFilters()

      // Enables button ripples
      this._rippleHandler.init()

      // Load event handlers
      this._addHandlers()
    }).catch(error => console.error(error))

    // Load stored title if one present
    this.renderTitle()

    // Load select options for who suggested a movie
    this.renderWhos()
  }

  renderTitle () {
    const title = localStorage.getItem('title') || 'Movie Chooser'
    document.querySelector('.header__title').innerText = title
  }

  renderWhos () {
    const whosSelect = document.querySelector('select')
    const fragment = document.createDocumentFragment()

    Object.keys(App.WHOS).forEach(who => {
      const newOption = document.createElement('option')
      newOption.value = who
      newOption.textContent = who
      fragment.appendChild(newOption)
    })

    whosSelect.appendChild(fragment)
  }

  renderWhosFilters () {
    const filtersContainer = document.querySelector('.filter-group')
    const fragment = document.createDocumentFragment()

    Object.keys(App.WHOS).forEach((who) => {
      const newFilter = document.createElement('button')
      newFilter.classList.add('ripple', 'filter-btn', 'btn-sm', 'js-filter')
      newFilter.style.backgroundColor = App.WHOS[who].primary
      newFilter.innerText = who
      newFilter.addEventListener('click', this._filterRandom)
      fragment.appendChild(newFilter)
    })

    filtersContainer.appendChild(fragment)
  }

  savetoStore (newMovie) {
    // Add movie to list
    const movieList = document.querySelector('movie-list')
    movieList.addMovie(newMovie).then(_ => {
      // Clear form and re-focus name field for new entry
      this._clearFormValues()
      document.querySelector('input[name=movie]').focus()
    }).catch(error => console.error(error))
  }

  addMovie (evt) {
    if (evt) evt.preventDefault()

    const movieName = document.querySelector('[name=movie]').value
    const who = document.querySelector('[name=who]').value

    if (movieName && who) {
      const newMovie = {name: movieName, who}
      this.savetoStore(newMovie)
    } else {
      // [TODO] Display this to the screen.
      console.warn('You\'ve forgotten to provide some information. Try again...')
      alert('You\'ve forgotten to provide some information. Try again...')
    }
  }

  chooseRandom (evt) {
    if (evt) evt.preventDefault()
    const movieList = document.querySelector('movie-list')

    if (movieList.hasAttribute('loading')) {
      return
    }

    requestAnimationFrame(_ => {
      movieList.showSpinner()

      const delayRender = _ => {
        const activeFilter = document.querySelector('.js-filter.active')
        const filterText = (activeFilter) ? activeFilter.textContent : ''

        movieList.chooseRandom(filterText)
        movieList.hideSpinner()
      }

      setTimeout(delayRender, 3000)
    })
  }

  _lazyLoadScript (src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  _lazyLoadImport (href) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'import'
      link.async = true
      link.href = href
      link.onload = resolve
      link.onerror = error => reject(`Error occurred loading HTML imports: ${error}`)
      document.head.appendChild(link)
    })
  }

  _createBindings () {
    this.init = this.init.bind(this)
    this.renderTitle = this.renderTitle.bind(this)
    this.renderWhos = this.renderWhos.bind(this)
    this.renderWhosFilters = this.renderWhosFilters.bind(this)
    this.savetoStore = this.savetoStore.bind(this)
    this.addMovie = this.addMovie.bind(this)
    this.chooseRandom = this.chooseRandom.bind(this)
    this._addHandlers = this._addHandlers.bind(this)
    this._doubleTapHandler = this._doubleTapHandler.bind(this)
    this._saveTitleOnBlur = this._saveTitleOnBlur.bind(this)
    this._filterRandom = this._filterRandom.bind(this)
  }

  _addHandlers () {
    const title = document.querySelector('.header__title')

    // Add handler for Choose button
    document.querySelector('#choose').addEventListener('click', this.chooseRandom)

    // Add handler to submit form
    document.querySelector('form').addEventListener('submit', this.addMovie)

    // Add handler for editing title
    title.addEventListener('dblclick', evt => {
      // Make title editable and select all text
      evt.target.setAttribute('contenteditable', 'true')
      evt.target.focus()
      this._selectText(evt.target)

      // Add handlers for Enter key to save title
      document.addEventListener('keypress', this._saveTitleOnEnter)

      // Add handler to save title when you click/tap off title
      title.addEventListener('blur', this._saveTitleOnBlur)
    })

    // Add doubletap handler for mobile
    document.addEventListener('touchstart', this._doubleTapHandler)
  }

  _doubleTapHandler (evt) {
    if (!this._tappedTwice) {
      this._tappedTwice = true
      setTimeout(_ => { this._tappedTwice = false }, 300)
      return false
    }

    evt.preventDefault()
    evt.target.dispatchEvent(new MouseEvent('dblclick'))
  }

  _saveTitleOnEnter (evt) {
    if (evt.keyCode === App.ENTER_KEYCODE) {
      evt.preventDefault()

      const focussed = document.querySelector(':focus')

      if (focussed === evt.target) {
        evt.target.blur()
      }
    }
  }

  _saveTitleOnBlur (evt) {
    const newTitle = evt.target.innerText
    const storedTitle = localStorage.getItem('title') || 'Movie Chooser'

    if (newTitle) {
      if (newTitle !== storedTitle) {
        localStorage.setItem('title', newTitle)
      }
    } else {
      evt.target.innerText = storedTitle
    }

    evt.target.removeAttribute('contenteditable')

    // Remove save title handlers
    document.removeEventListener('keypress', this._saveTitleOnEnter)
    document.querySelector('.header__title').removeEventListener('blur', this._saveTitleOnBlur)
  }

  _clearFormValues () {
    document.querySelector('input[name=movie]').value = ''
    document.querySelector('select[name=who]').value = ''
  }

  _selectText (element) {
    let range = null
    if (document.body.createTextRange) {
      range = document.body.createTextRange()
      range.moveToElementText(element)
      range.select()
    } else if (window.getSelection) {
      const selection = window.getSelection()
      range = document.createRange()
      range.selectNodeContents(element)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  _filterRandom (evt) {
    if (evt.target.classList.contains('active')) {
      evt.target.classList.remove('active')
      return
    }

    const unselected = Array.from(document.querySelectorAll('.js-filter.active'))
    unselected.forEach(uns => uns.classList.remove('active'))
    evt.target.classList.add('active')
  }
}

const app = new App()
window.addEventListener('load', _ => app.init())
