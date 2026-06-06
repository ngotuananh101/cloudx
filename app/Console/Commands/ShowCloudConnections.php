<?php

namespace App\Console\Commands;

use App\Models\CloudConnection;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('cloud:show {id : The ID of the cloud connection}')]
#[Description('Show unencrypted cloud connection in a table by ID')]
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

        $headers = ['ID', 'User ID', 'Name', 'Provider', 'Status', 'Credentials (Unencrypted)'];

        $rows = [
            [
                $connection->id,
                $connection->user_id,
                $connection->name,
                $connection->provider?->value ?? $connection->provider,
                $connection->status?->value ?? $connection->status,
                json_encode($connection->credentials),
            ],
        ];

        $this->table($headers, $rows);
    }
}
