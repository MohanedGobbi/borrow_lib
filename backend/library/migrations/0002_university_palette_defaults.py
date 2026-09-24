from django.db import migrations, models


class Migration(migrations.Migration):
    """Default colors follow the university palette (was burnt orange / amber)."""

    dependencies = [
        ("library", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="category",
            name="color",
            field=models.CharField(default="#4A5560", max_length=9),
        ),
        migrations.AlterField(
            model_name="book",
            name="cover_color",
            field=models.CharField(default="#1F4D3A", max_length=9),
        ),
    ]
