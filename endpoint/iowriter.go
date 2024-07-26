package endpoint

import "io"

type IoWriter interface {
	Write(writer io.Writer) error
}
