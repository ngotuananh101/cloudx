<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('cloud_task', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cloud_connection_id')->constrained()->cascadeOnDelete();
            $table->tinyInteger('type');
            $table->tinyInteger('status');
            $table->string('target_path')->default('');
            $table->string('name');
            $table->json('payload');
            $table->json('result')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('processing_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['cloud_connection_id', 'status']);
            $table->index(['type', 'status']);
        });

        Schema::create('cloud_task_chunks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cloud_task_id')->constrained('cloud_task')->cascadeOnDelete();
            $table->unsignedInteger('index');
            $table->unsignedInteger('size');
            $table->string('checksum')->nullable();
            $table->timestamps();

            $table->unique(['cloud_task_id', 'index']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cloud_task_chunks');
        Schema::dropIfExists('cloud_task');
    }
};
