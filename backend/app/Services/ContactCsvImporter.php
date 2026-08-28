<?php

namespace App\Services;

use App\Enums\ContactCategory;
use App\Models\Contact;
use App\Models\Workspace;

/**
 * Expects a header row naming the columns it recognizes (name, email, phone,
 * category, organization, notes — any subset, any order). Deliberately does
 * NOT fall back to guessing a fixed column order when no header is
 * recognized: silently mis-mapping columns would import garbage contacts
 * with no way for the operator to notice, so an unrecognized header is
 * reported as an error instead.
 */
class ContactCsvImporter
{
    private const KNOWN_COLUMNS = ['name', 'email', 'phone', 'category', 'organization', 'notes'];

    /**
     * @return array{created: int, skipped: int, errors: array<int, string>}
     */
    public function import(Workspace $workspace, string $filePath, ?int $userId): array
    {
        $handle = fopen($filePath, 'r');

        if (! $handle) {
            return ['created' => 0, 'skipped' => 0, 'errors' => ['Could not read the file.']];
        }

        $header = fgetcsv($handle);

        if (! $header) {
            fclose($handle);

            return ['created' => 0, 'skipped' => 0, 'errors' => ['The file appears to be empty.']];
        }

        $columnMap = $this->mapColumns($header);

        if ($columnMap === null) {
            fclose($handle);

            return [
                'created' => 0,
                'skipped' => 0,
                'errors' => ['No recognized columns in the first row. Expected a header with: '.implode(', ', self::KNOWN_COLUMNS).'.'],
            ];
        }

        $created = 0;
        $skipped = 0;
        $errors = [];
        $rowNumber = 1; // the header itself is row 1

        while (($row = fgetcsv($handle)) !== false) {
            $rowNumber++;

            if (count(array_filter($row, fn ($cell) => trim((string) $cell) !== '')) === 0) {
                continue; // blank line
            }

            $data = $this->extractRow($row, $columnMap);

            if ($data['name'] === '') {
                $skipped++;
                $errors[] = "Row {$rowNumber}: missing a name, skipped.";

                continue;
            }

            Contact::create([
                'workspace_id' => $workspace->id,
                'created_by' => $userId,
                'name' => $data['name'],
                'email' => $data['email'] !== '' ? $data['email'] : null,
                'phone' => $data['phone'] !== '' ? $data['phone'] : null,
                'category' => ContactCategory::tryFrom(strtolower($data['category'])) ?? ContactCategory::Other,
                'organization' => $data['organization'] !== '' ? $data['organization'] : null,
                'notes' => $data['notes'] !== '' ? $data['notes'] : null,
            ]);
            $created++;
        }

        fclose($handle);

        return ['created' => $created, 'skipped' => $skipped, 'errors' => $errors];
    }

    /**
     * @param  array<int, string|null>  $header
     * @return array<string, int>|null column name => index, or null if no known column was found
     */
    private function mapColumns(array $header): ?array
    {
        $map = [];

        foreach ($header as $index => $columnName) {
            $normalized = strtolower(trim((string) $columnName));

            if (in_array($normalized, self::KNOWN_COLUMNS, true)) {
                $map[$normalized] = $index;
            }
        }

        // A name column is the one thing every row needs — without it there's
        // nothing to import even if other columns matched.
        return array_key_exists('name', $map) ? $map : null;
    }

    /**
     * @param  array<int, string|null>  $row
     * @param  array<string, int>  $columnMap
     * @return array<string, string>
     */
    private function extractRow(array $row, array $columnMap): array
    {
        $data = [];

        foreach (self::KNOWN_COLUMNS as $name) {
            $index = $columnMap[$name] ?? null;
            $data[$name] = $index !== null ? trim((string) ($row[$index] ?? '')) : '';
        }

        return $data;
    }
}
