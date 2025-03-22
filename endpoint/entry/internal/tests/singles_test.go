package tests

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/yinloo-ola/tournament-manager/endpoint/entry/internal"
	"github.com/yinloo-ola/tournament-manager/utils"
)

func TestImportSinglesEntries(t *testing.T) {
	// Generate mock Excel
	excelData, err := utils.GenerateMockSinglesExcel()
	assert.NoError(t, err)

	// Create request with Excel data
	req := httptest.NewRequest("POST", "/importSinglesEntry", bytes.NewReader(excelData.Bytes()))
	req.Header.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

	// Call handler
	rec := httptest.NewRecorder()
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		entries, err := internal.ImportSinglesEntries(r.Context(), r.Body)
		if assert.NoError(t, err) {
			assert.Len(t, entries, 3)
			w.WriteHeader(http.StatusOK)
		}
	})

	handler.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
}
