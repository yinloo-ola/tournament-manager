package web

import "embed"

//go:embed all:dist
var WebStatic embed.FS
