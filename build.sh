#!/bin/sh
npx esbuild js/app.js --bundle --format=iife --outfile=js/app.bundle.js
