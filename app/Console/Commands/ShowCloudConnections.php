<?php

namespace App\Console\Commands;

use App\Models\CloudConnection;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('cloud:show {id : The ID of the cloud connection} {--reveal : Show decrypted credentials}')]
#[Description('Show cloud connection details by ID')]
class ShowCloudConnections extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        $id = $this->argument('id');
        $connection = CloudConnection::find($id);

        if (! $connection) {
            $this->error("Cloud connection with ID {$id} not found.");

            return;
        }

        $revealCredentials = (bool) $this->option('reveal');

        if ($revealCredentials && ! app()->isLocal() && ! app()->runningUnitTests()) {
            $this->error('Credential reveal is only available in the local environment.');

            return;
        }

        $headers = ['ID', 'User ID', 'Name', 'Provider', 'Status', 'Credentials'];
        $credentials = $revealCredentials
            ? json_encode($connection->credentials)
            : '[hidden — pass --reveal in local]';

        $rows = [
            [
                $connection->id,
                $connection->user_id,
                $connection->name,
                $connection->provider?->value ?? $connection->provider,
                $connection->status?->value ?? $connection->status,
                $credentials,
            ],
        ];

        $this->table($headers, $rows);
    }
}
