package color

import (
	"fmt"
	"math"
	"math/rand"
	"time"
)

// ColorMode is an enum to specify whether to generate dark or light colors
type ColorMode int

const (
	Dark  ColorMode = iota // 0
	Light                  // 1
)

// GenerateColors generates numColors distinctly different colors based on the provided mode (dark or light)
func GenerateColors(numColors int, mode ColorMode) []string {
	colors := make([]string, 0, numColors)
	rand.Seed(time.Now().UnixNano())

	// Define saturation and lightness based on the mode
	var saturation, lightness float64
	switch mode {
	case Dark:
		saturation = 0.5 + rand.Float64()*0.5 // 0.5-1.0
		lightness = 0.2 + rand.Float64()*0.3  // 0.2-0.5
	case Light:
		saturation = 0.5 + rand.Float64()*0.5 // 0.5-1.0
		lightness = 0.7 + rand.Float64()*0.2  // 0.7-0.9
	}

	// Generate colors with evenly spaced hues
	hueStep := 360.0 / float64(numColors)
	for i := 0; i < numColors; i++ {
		hue := math.Mod(float64(i)*hueStep+rand.Float64()*10, 360) // Add a small random offset to avoid patterns
		color := hslToRGB(hue, saturation, lightness)
		colors = append(colors, color)
	}

	return colors
}

// hslToRGB converts HSL to RGB in the format "#RRGGBB"
func hslToRGB(h, s, l float64) string {
	var r, g, b float64

	if s == 0 {
		r, g, b = l, l, l // Achromatic (gray)
	} else {
		var q float64
		if l < 0.5 {
			q = l * (1 + s)
		} else {
			q = l + s - l*s
		}
		p := 2*l - q
		r = hueToRGB(p, q, h+120)
		g = hueToRGB(p, q, h)
		b = hueToRGB(p, q, h-120)
	}

	return fmt.Sprintf("#%02X%02X%02X", int(r*255), int(g*255), int(b*255))
}

// hueToRGB converts a hue to an RGB value
func hueToRGB(p, q, t float64) float64 {
	if t < 0 {
		t += 360
	}
	if t > 360 {
		t -= 360
	}
	if t < 60 {
		return p + (q-p)*t/60
	}
	if t < 180 {
		return q
	}
	if t < 240 {
		return p + (q-p)*(240-t)/60
	}
	return p
}
