-- DropIndex
DROP INDEX "orders_status_created_idx";

-- CreateIndex
CREATE INDEX "brands_name_trgm_idx" ON "brands" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "categories_name_trgm_idx" ON "categories" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "variants_sku_trgm_idx" ON "product_variants" USING GIN ("sku" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "products_title_trgm_idx" ON "products" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "products_tags_idx" ON "products" USING GIN ("tags");
