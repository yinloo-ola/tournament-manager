package pointer

func Of[T any](o T) *T {
	return &o
}
func Nil[T any]() *T {
	return nil
}
