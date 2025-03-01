package pointer

func Of[T any](o T) *T {
	return &o
}
func OrNil[T comparable](o T) *T {
	var zero T
	if o == zero {
		return nil
	}
	return &o
}
func Nil[T any]() *T {
	return nil
}
