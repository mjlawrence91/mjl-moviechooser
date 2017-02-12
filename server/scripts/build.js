#! /usr/bin/node
import path from 'path'
import {cp} from 'shelljs'

const rootPath = path.resolve(__dirname, '../../', 'client')

const files = [
  'index.html',
  'manifest.json',
  'style.css',
  'robots.txt',
  'spinner.png',
  'elements/movie-list.html',
  'elements/movie-list-item.html'
]

const paths = files.map(file => rootPath + '/' + file)
cp(...paths, path.join(rootPath, 'dist'))
